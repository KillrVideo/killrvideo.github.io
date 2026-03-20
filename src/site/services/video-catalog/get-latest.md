---
title: "GET /api/v1/videos/latest"
description: "Retrieve the most recently added videos using time-series data modeling"
endpoint: "/api/v1/videos/latest"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-latest.spec.md"
concepts:
  - time-series-data-modeling
  - bucketing-by-day
  - clustering-columns
  - denormalized-tables
  - pagination
order: 2
draft: true
---

# GET /api/v1/videos/latest - Latest Videos Feed

## Overview

This endpoint returns the most recently added videos in reverse chronological order. It is the home-feed equivalent of KillrVideo — the first thing a visitor sees. Behind the scenes, it showcases one of Cassandra's most important design patterns: **time-series data modeling with date bucketing**.

**Why it exists**: Showing "what's new" is a universal feature for any media platform. Implementing it correctly in Cassandra requires special thought around how data is partitioned and ordered in time.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/latest`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `pageSize` | integer | 9 | Number of results per page (max 20) |

### Request

```http
GET /api/v1/videos/latest?page=1&pageSize=9
```

### Response Body

```json
{
  "items": [
    {
      "videoId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Introduction to Apache Cassandra",
      "previewImageLocation": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      "addedDate": "2025-10-31T10:30:00Z"
    }
  ],
  "total": 247,
  "page": 1,
  "pageSize": 9
}
```

## Cassandra Concepts Explained

### Time-Series Data Modeling

A **time-series** dataset is one where records are naturally ordered by time and queries typically ask "give me the N most recent items". Cassandra handles this beautifully, but the design matters enormously.

**The naive approach** — using a single partition for all videos:
```
PARTITION KEY: (something_global)
CLUSTERING KEY: added_date DESC
```
This creates one massive partition that grows forever ("unbounded partition"), which is a well-known Cassandra anti-pattern that degrades performance over time.

**The right approach** — bucketing by time period.

### Bucketing by Day

**Bucketing** means grouping records into finite-sized partitions by a time unit (day, week, month). Each "bucket" is a separate Cassandra partition with a bounded, manageable size.

```
Bucket "2025-10-31" → holds all videos added on Oct 31, 2025
Bucket "2025-10-30" → holds all videos added on Oct 30, 2025
Bucket "2025-10-29" → holds all videos added on Oct 29, 2025
```

Think of it like physical filing cabinets — one cabinet per day, files sorted newest-first within each cabinet. To get the latest videos, you open today's cabinet first, then yesterday's if you need more.

**Why day buckets?** Daily upload volumes are predictable. On a typical platform, a day's bucket might hold 50–500 videos — a perfectly manageable partition size.

### Clustering Columns and Ordering

Within each bucket partition, rows are physically sorted on disk by the **clustering columns**. By setting `added_date DESC`, Cassandra stores the newest video first in each partition, making range reads extremely fast.

```
Partition: "2025-10-31"
  Row 1: added_date=2025-10-31T23:59:00, videoid=xxx  ← newest first
  Row 2: added_date=2025-10-31T22:00:00, videoid=yyy
  Row 3: added_date=2025-10-31T10:30:00, videoid=zzz  ← oldest in bucket
```

### Denormalized Tables

The `latest_videos` table is a **denormalized** copy of video data, shaped specifically for this query. It stores only the fields needed for a summary card: title, thumbnail, and date. This is the Cassandra way — you design tables around your query patterns, not around normalization.

## Data Model

### Table: `latest_videos`

```cql
CREATE TABLE killrvideo.latest_videos (
    added_date_bucket  text,       -- Partition key: date string "YYYY-MM-DD"
    added_date         timestamp,  -- Clustering col: actual add timestamp
    videoid            uuid,       -- Clustering col: breaks ties
    name               text,       -- Video title
    preview_image_location text,   -- Thumbnail URL
    userid             uuid,       -- Uploader's user ID
    PRIMARY KEY ((added_date_bucket), added_date, videoid)
) WITH CLUSTERING ORDER BY (added_date DESC, videoid ASC);
```

**Key characteristics**:
- **Partition Key**: `added_date_bucket` — the date string (e.g., `"2025-10-31"`)
- **Clustering Columns**: `added_date DESC, videoid ASC` — newest first, UUID breaks ties
- **Bounded partitions**: Each partition holds at most one day of uploads
- **Read pattern**: Query one or more day buckets in descending order

## Database Queries

### Query: Fetch Latest Videos From a Bucket

**Equivalent CQL**:
```cql
SELECT videoid, name, preview_image_location, added_date, userid
FROM killrvideo.latest_videos
WHERE added_date_bucket = '2025-10-31'
ORDER BY added_date DESC
LIMIT 9;
```

**Performance**: Very fast — single partition read, data is pre-sorted on disk.

### Handling Pagination Across Buckets

The tricky part of this endpoint is that a single day bucket may not contain enough videos to fill a page. The implementation fetches from multiple consecutive day buckets until it has enough results:

```
Need 9 results for page 1:
  1. Query bucket "2025-10-31" → got 3 videos
  2. Query bucket "2025-10-30" → got 9 videos, take 6 more
  Total: 9 ✓
```

**Equivalent CQL for multi-bucket strategy**:
```cql
-- Bucket 1
SELECT * FROM killrvideo.latest_videos
WHERE added_date_bucket = '2025-10-31'
ORDER BY added_date DESC;

-- Bucket 2 (if needed)
SELECT * FROM killrvideo.latest_videos
WHERE added_date_bucket = '2025-10-30'
ORDER BY added_date DESC;
```

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/latest?page=1         │
│    &pageSize=9                                           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate query parameters                             │
│    ├─ page >= 1                                          │
│    └─ pageSize between 1 and 20                          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Determine which day buckets to query                  │
│    Start with today, work backwards as needed            │
│    e.g., ["2025-10-31", "2025-10-30", "2025-10-29", ...]│
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Query latest_videos bucket by bucket                  │
│    Accumulate results until pageSize is reached          │
│    Skip records already shown on previous pages          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Assemble PaginatedResponse                            │
│    { items: [...], total, page, pageSize }               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Return 200 OK                                         │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. The Unbounded Partition Anti-Pattern

**Never do this** for a growing time-series:

```cql
-- BAD: one partition for ALL videos
CREATE TABLE all_videos_bad (
    dummy_key text,    -- e.g., always "videos"
    added_date timestamp,
    videoid uuid,
    PRIMARY KEY (dummy_key, added_date)
) WITH CLUSTERING ORDER BY (added_date DESC);
```

This creates a single partition that grows to millions of rows over time. A Cassandra partition has no hard size limit, but performance degrades dramatically as partitions grow beyond a few hundred MB. **Bucketing solves this.**

### 2. Write Amplification

When a new video is submitted, the system must write to **both** the `videos` table (source of truth) and the `latest_videos` table (query-optimized copy). This is expected in Cassandra's design philosophy: optimize for read performance at the cost of some write complexity.

### 3. Bucket Boundary at Midnight UTC

Bucket assignment uses UTC midnight to avoid timezone ambiguity:
```
"2025-10-31" = all videos where added_date is on Oct 31, 2025 UTC
```

Querying by local time could produce inconsistent results across different regions.

### 4. Empty Buckets Are Normal

During low-activity periods (weekends, holidays), a day bucket may be empty. The implementation must handle this gracefully — skip the empty bucket and move to the previous day.

### 5. Total Count Is an Estimate

The `total` field in the paginated response is typically an approximation (e.g., total entries in the `videos` table), not an exact count from the `latest_videos` table. Exact counts in Cassandra require a full table scan, which is expensive.

## Developer Tips

### Common Pitfalls

1. **Querying without a partition key**: `SELECT * FROM latest_videos ORDER BY added_date DESC` is a full table scan — never do this in production.

2. **Forgetting the DESC ordering**: Without `WITH CLUSTERING ORDER BY (added_date DESC)`, you'd get oldest-first and have to reverse in application code.

3. **Too-large buckets**: Using a yearly bucket means partitions grow very large. Daily is a good default; hourly may be needed for extremely high-volume platforms.

4. **Off-by-one in pagination**: When skipping records for page 2, be careful to offset correctly across bucket boundaries.

### Best Practices

1. **Pre-calculate bucket strings server-side**: Don't trust the client to specify which bucket to read.

2. **Limit bucket lookback**: If a video is more than 30 days old, it should not appear in the "latest" feed — limit how many buckets the query traverses.

3. **Cache the first page aggressively**: The first page of the latest feed is viewed far more than any other. A 60-second cache here dramatically reduces database load.

4. **Add a `latest_videos` write when a video becomes READY**: Videos go through a processing pipeline. Only write to `latest_videos` once status = READY, not when first submitted.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Today's bucket has enough videos | < 5ms | Single partition read |
| Spanning 2–3 day buckets | 10–20ms | Sequential partition reads |
| Cache hit (first page) | < 1ms | Near-zero cost |

### Related Endpoints

- [GET /api/v1/videos/trending](/services/video-catalog/get-trending/) - Trending instead of chronological
- [GET /api/v1/videos/by-uploader/{id}](/services/video-catalog/get-by-uploader/) - Videos from a specific user
- [POST /api/v1/videos](/services/video-catalog/post-video/) - Submit a new video

## Further Learning

- [Cassandra Time-Series Data Modeling](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-chebotko.html)
- [Avoiding Unbounded Partitions](https://docs.datastax.com/en/dse/6.8/dse-dev/datastax_enterprise/dbInternals/dbIntInternalsBucketingTimeSeries.html)
- [Clustering Columns and Ordering](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useClusterColSort.html)
