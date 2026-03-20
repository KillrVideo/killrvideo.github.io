---
title: "GET /api/v1/videos/trending"
description: "Retrieve trending videos ranked by view count within a configurable time window"
endpoint: "/api/v1/videos/trending"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-trending.spec.md"
concepts:
  - time-windowed-aggregation
  - counter-based-ranking
  - materialized-time-buckets
  - top-n-queries
order: 10
draft: true
---

# GET /api/v1/videos/trending - Trending Videos

## Overview

This endpoint returns the top N videos ranked by view count within a specific time window (1, 7, or 30 days). Unlike the latest feed (which is purely chronological), trending combines **recency** with **popularity** to surface what the community is most engaged with right now.

**Why it exists**: A chronological feed rewards the most recent uploads. A trending feed rewards the most-watched content within a time period — a fundamentally different and complementary discovery mechanism.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/trending`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Query Parameters

| Parameter | Type | Default | Allowed Values | Description |
|-----------|------|---------|----------------|-------------|
| `intervalDays` | integer | 7 | 1, 7, 30 | Time window in days |
| `limit` | integer | 5 | 1–10 | Number of results to return |

### Request

```http
GET /api/v1/videos/trending?intervalDays=7&limit=5
```

### Response Body

```json
[
  {
    "videoId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Cassandra 5.0 - What's New",
    "previewImageLocation": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    "addedDate": "2025-10-28T09:00:00Z",
    "views": 8429
  }
]
```

Note: Returns an array directly (not wrapped in a PaginatedResponse), since the maximum size is limited to 10.

## Cassandra Concepts Explained

### Time-Windowed Aggregation

The core challenge: "Which videos got the most views in the last 7 days?"

In a SQL database, you might write:
```sql
SELECT video_id, SUM(view_count_delta) as total_views
FROM daily_view_counts
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY video_id
ORDER BY total_views DESC
LIMIT 5;
```

Cassandra does not support `GROUP BY` with aggregation across partitions in the same way. Several approaches work:

**Approach 1: Pre-aggregated counter tables**

Maintain separate counter tables per time window:
```cql
CREATE TABLE killrvideo.trending_day (
    date_bucket text,   -- "2025-10-31"
    videoid     uuid,
    views       counter,
    PRIMARY KEY ((date_bucket), views, videoid)
) WITH CLUSTERING ORDER BY (views DESC);
```

Every view increment updates both `videos.views` AND the current day's trending table.

**Approach 2: Application-layer aggregation**

Fetch recent videos and their view counts, sort in memory:
```python
cutoff = now() - timedelta(days=interval_days)
recent_videos = await fetch_videos_added_after(cutoff)
sorted_videos = sorted(recent_videos, key=lambda v: v.views, reverse=True)
return sorted_videos[:limit]
```

**Approach 3: External system (Redis sorted sets)**

Use Redis `ZADD` / `ZREVRANGE` to maintain a sorted set of video IDs by view count, with separate sets per time window.

KillrVideo's implementation uses Application-layer aggregation for simplicity, which works well at demonstration scale.

### Counter-Based Ranking

Ranking by `views` (a counter column) introduces eventual consistency into the ranking. Two important implications:

1. **Rankings are approximate**: View counts are eventually consistent. Two requests milliseconds apart might return slightly different rankings.
2. **That's acceptable**: Trending algorithms are inherently approximate. Users don't expect mathematical precision from a "trending" feed.

### Materialized Time Buckets

For a high-scale production system, you would pre-materialize the trending results:

```
Background job (runs every 5 minutes):
  1. Count views per video in the last 7 days
  2. Sort by view count
  3. Write top 10 to a dedicated trending table

On request:
  1. Read from trending table (single fast read)
  2. Return pre-computed results
```

This trades accuracy (stale by up to 5 minutes) for performance (no aggregation on the hot path).

## Data Model

### Primary Table: `videos`

```cql
CREATE TABLE killrvideo.videos (
    videoid    uuid PRIMARY KEY,
    userid     uuid,
    name       text,
    preview_image_location text,
    added_date timestamp,
    views      counter,
    status     text
);
```

The trending query reads `views` and `added_date` to find videos within the time window with the highest view counts.

### Alternative: Materialized Trending Table

```cql
CREATE TABLE killrvideo.trending_videos (
    window_days int,     -- 1, 7, or 30
    rank        int,     -- 1 through 10
    videoid     uuid,
    views       bigint,  -- snapshot at computation time
    name        text,
    preview_image_location text,
    PRIMARY KEY ((window_days), rank)
);
```

Reads are a single partition: `WHERE window_days = 7`.

## Database Queries

### Application-Layer Approach: Fetch and Sort

**Step 1**: Fetch videos within the time window
```cql
SELECT videoid, userid, name, preview_image_location, added_date, views
FROM killrvideo.videos
WHERE added_date >= '2025-10-24T00:00:00Z'  -- 7 days ago
  AND status = 'READY'
ALLOW FILTERING;
```

**Step 2**: Sort in application code
```python
trending = sorted(videos, key=lambda v: v.views, reverse=True)[:limit]
```

**Limitation**: This approach requires a full table scan filtered by `added_date`. In production, this is only acceptable with an SAI index on `added_date` or a dedicated trending table.

### Materialized Approach: Single Read

```cql
SELECT * FROM killrvideo.trending_videos
WHERE window_days = 7
ORDER BY rank ASC
LIMIT 5;
```

This is O(1) — one partition, no aggregation.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/trending              │
│    ?intervalDays=7&limit=5                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate parameters                                   │
│    ├─ intervalDays in {1, 7, 30}? → proceed              │
│    └─ limit in [1, 10]? → proceed                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Calculate cutoff date: now() - intervalDays           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Query: fetch READY videos with added_date >= cutoff   │
│    Sorted by views DESC, limited to max(limit, buffer)   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Trim to requested limit                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with array of VideoSummary              │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. The `intervalDays` Parameter Is Constrained

Only 1, 7, and 30 are valid values. This is intentional — arbitrary time windows would make materialized approaches impractical (you'd need a trending table for every possible value). The three allowed values map to: daily trends, weekly trends, and monthly trends.

### 2. Maximum Limit of 10

The `limit` parameter is capped at 10. Trending feeds are inherently about the "top few" — returning 100 "trending" videos makes the concept meaningless.

### 3. Views Count Is Total, Not Window-Specific

A limitation of the application-layer approach: the `views` column in `videos` is the **total all-time view count**, not views within the time window. A video published 2 years ago with 1 million total views would dominate over a video published yesterday with 10,000 views in 24 hours.

A true trending algorithm would track views per time bucket and compare rates, not absolute totals. The materialized approach solves this by computing views-in-window separately.

### 4. Caching Is Highly Recommended

Trending is a perfect candidate for aggressive caching:
- Cache the response in Redis with a 5-minute TTL
- All users asking for the same `intervalDays` get the same cached response
- This turns an expensive aggregation query into a single cache lookup

### 5. Empty Result Set

If no videos have been added in the requested time window (unlikely, but possible for intervalDays=1 on a quiet day), the response is an empty array:
```json
[]
```

## Developer Tips

### Common Pitfalls

1. **No caching on trending**: Without caching, this endpoint triggers an expensive aggregation on every request. Always cache the results.

2. **Allowing arbitrary intervalDays**: Validate strictly. `intervalDays=365` would attempt to scan a year's worth of videos.

3. **Confusing total views with window views**: Be clear in the UI whether "views" means "all time" or "in this window."

4. **Returning more than the limit**: Trim strictly to `limit` before returning. Don't accidentally return 11 when the user requested 10.

### Best Practices

1. **Pre-materialize trending results**: A background job that runs every 5–15 minutes is far better than on-demand aggregation.

2. **Use Redis sorted sets for trending**: Redis `ZADD` and `ZREVRANGE` are built exactly for this use case.

3. **Show "view velocity" alongside counts**: "1,200 views in the last 7 days" is more meaningful than "12,000 total views."

4. **Consider a dedicated trending microservice**: At scale, trending computation deserves its own service with specialized infrastructure.

### Performance Expectations

| Approach | Latency | Notes |
|----------|---------|-------|
| Application aggregation (no cache) | 50–500ms | Depends on table size |
| Materialized table | 5ms | Single partition read |
| Redis cache hit | < 1ms | In-memory lookup |

### Related Endpoints

- [GET /api/v1/videos/latest](/services/video-catalog/get-latest/) - Chronological feed, not popularity-ranked
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Full details for any trending video
- [POST /api/v1/videos/{id}/view](/services/video-catalog/post-view/) - The writes that feed the view counter

## Further Learning

- [Redis Sorted Sets for Leaderboards](https://redis.io/docs/data-types/sorted-sets/)
- [Cassandra Counter Tables](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useCounters.html)
- [Materialized Views in Cassandra](https://cassandra.apache.org/doc/latest/cassandra/cql/mvs.html)
- [Trending Algorithm Design](https://medium.com/hacker-daily/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d)
