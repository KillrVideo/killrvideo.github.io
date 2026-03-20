---
title: "GET /api/v1/videos/id/{video_id}/rating"
description: "Get the average rating and total rating count for a video"
endpoint: "/api/v1/videos/id/{video_id}/rating"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-rating.spec.md"
concepts:
  - aggregation-queries
  - partition-scan-for-aggregation
  - computed-averages
  - read-all-rows-in-partition
order: 12
draft: true
---

# GET /api/v1/videos/id/{video_id}/rating - Video Rating Summary

## Overview

This endpoint returns the aggregate rating summary for a video: the average star rating and the total number of ratings submitted. It demonstrates how Cassandra handles **intra-partition aggregation** — computing a summary over all rows within a single partition.

**Why it exists**: Video pages and listing cards need to display rating information (e.g., "⭐ 4.2 / 5 (847 ratings)"). Rather than exposing raw rating rows, this endpoint returns a pre-computed summary.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/id/{video_id}/rating`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to get ratings for |

### Request

```http
GET /api/v1/videos/id/550e8400-e29b-41d4-a716-446655440000/rating
```

### Response Body

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "averageRating": 4.2,
  "ratingCount": 847
}
```

## Cassandra Concepts Explained

### Intra-Partition Aggregation

Cassandra's partition model makes some aggregations very natural. The `video_ratings` table stores all ratings for a video within a **single partition** (partition key = `videoid`). Computing the average means:
1. Read all rows in the partition (all raters for this video)
2. Sum the `rating` values
3. Divide by the count

This is called **intra-partition aggregation** — aggregating within a single partition. It is efficient because Cassandra only needs to contact the replicas for that one partition, not the entire cluster.

**Contrast with inter-partition aggregation**: Summing ratings across all videos would require reading all partitions — this is a full table scan, which is expensive in Cassandra.

```
CQL: SELECT COUNT(*), AVG(rating) FROM video_ratings
     WHERE videoid = 550e...;
                      ↑
         Single partition — fast!
```

### CQL Aggregate Functions

Cassandra supports basic aggregate functions on single-partition queries:
- `COUNT(*)` — count of matching rows
- `SUM(column)` — sum of values
- `AVG(column)` — average (requires COUNT and SUM internally)
- `MIN(column)` / `MAX(column)` — range

```cql
SELECT COUNT(*) as rating_count, AVG(rating) as avg_rating
FROM killrvideo.video_ratings
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Important**: These aggregations are computed by the Cassandra coordinator node — the node receives all matching rows from replicas and does the math. For large partitions (millions of ratings), this can be slow. For typical video ratings (up to hundreds of thousands), it is fast.

### Alternative: Pre-Aggregated Summary Table

A high-performance approach maintains the aggregate separately:

```cql
CREATE TABLE killrvideo.video_rating_summary (
    videoid      uuid PRIMARY KEY,
    rating_count counter,
    rating_total counter  -- Sum of all ratings submitted
);
```

Every time a user rates a video, also update:
```cql
UPDATE killrvideo.video_rating_summary
SET rating_count = rating_count + 1,
    rating_total = rating_total + 4  -- the submitted rating
WHERE videoid = ?;
```

Then average = `rating_total / rating_count` — computed in the application from two counter reads.

This eliminates the aggregation query entirely.

### Trade-offs: Aggregation vs. Pre-computation

| Approach | Read Performance | Write Complexity | Accuracy |
|----------|-----------------|------------------|----------|
| On-demand aggregation | O(partition size) | Simple (1 write) | Always exact |
| Pre-aggregated counters | O(1) | Complex (2 writes) | Approximate (counters) |

KillrVideo uses on-demand aggregation via the Data API for simplicity.

## Data Model

### Table: `video_ratings`

```cql
CREATE TABLE killrvideo.video_ratings (
    videoid    uuid,       -- Partition key
    userid     uuid,       -- Clustering column
    rating     int,        -- 1–5
    rated_date timestamp,
    PRIMARY KEY ((videoid), userid)
);
```

**Access pattern for this endpoint**: Read all rows in the partition for `videoid`, compute average.

## Database Queries

### Aggregate Rating Data

**CQL with aggregate functions**:
```cql
SELECT COUNT(*) as rating_count, AVG(rating) as avg_rating
FROM killrvideo.video_ratings
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Alternative: fetch all rows and aggregate in application code**:
```cql
SELECT rating
FROM killrvideo.video_ratings
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

Then in Python:
```python
ratings = [row["rating"] for row in result]
avg = sum(ratings) / len(ratings) if ratings else 0.0
count = len(ratings)
```

**Performance**: O(N) where N = number of raters for the video. For a video with 1,000 ratings, this reads 1,000 rows from a single partition.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/id/{video_id}/rating  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate UUID format of video_id                      │
│    └─ Invalid format? → 422                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Query: SELECT rating FROM video_ratings               │
│    WHERE videoid = ?                                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Aggregate in application:                             │
│    ├─ count = number of rows                             │
│    ├─ total = sum of rating values                       │
│    └─ avg = total / count (or 0.0 if no ratings)        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Return 200 with VideoRatingSummary                    │
│    { videoId, averageRating, ratingCount }               │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 SELECT (all rows in partition)
**Expected latency**: 5–50ms depending on rating count

## Special Notes

### 1. No Ratings Returns Zero

If a video has never been rated, the partition has no rows. The response should be:
```json
{
  "videoId": "550e8400-...",
  "averageRating": 0.0,
  "ratingCount": 0
}
```

Not a 404 — "no ratings yet" is a valid state, not an error.

### 2. Precision of Average

The `averageRating` field should be rounded to one or two decimal places:
- `4.2` not `4.235294117647059`

Python: `round(total / count, 2)` or `round(total / count, 1)`.

### 3. Video Existence Not Verified

Like the rating submission endpoint, this endpoint does not verify that the video exists. A request for a non-existent video returns `{ averageRating: 0.0, ratingCount: 0 }` rather than 404.

For strict REST semantics, you might want to first verify the video exists. For performance-sensitive implementations, the empty result is an acceptable signal.

### 4. Caching Opportunity

Rating summaries change relatively slowly — a video with 10,000 ratings receiving one new rating changes the average by only 0.01%. A short cache TTL (60 seconds) reduces database load significantly with minimal impact on accuracy.

### 5. Distribution Data Is Not Returned

This endpoint returns only the average and count, not the full distribution (how many 1-star, 2-star, etc.). Adding a distribution breakdown would require grouping the results, which is more complex. If distribution data is needed, extend the response model:

```json
{
  "videoId": "...",
  "averageRating": 4.2,
  "ratingCount": 847,
  "distribution": { "1": 12, "2": 28, "3": 95, "4": 312, "5": 400 }
}
```

## Developer Tips

### Common Pitfalls

1. **Dividing by zero**: If `ratingCount == 0`, return `averageRating: 0.0` — do not divide by zero.

2. **Returning very long decimals**: Round the average to 1–2 decimal places before serializing.

3. **Not caching**: This endpoint reads entire partitions. Cache aggressively.

4. **Assuming a 404 for no ratings**: Zero ratings is a valid state. Return 200 with count=0.

### Best Practices

1. **Pre-aggregate with counters** at scale: For platforms with millions of ratings per video, on-demand aggregation is too slow. Maintain `rating_count` and `rating_total` counter columns.

2. **Cache with short TTL**: 60-second cache TTL provides a good performance/freshness balance.

3. **Round consistently**: Decide on 1 or 2 decimal places and use it everywhere.

4. **Consider the "Bayesian average"**: For newly-rated videos with few ratings, show a Bayesian-adjusted average to prevent extreme scores from tiny sample sizes.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| 0 ratings | < 5ms | Empty partition read |
| 100 ratings | 5–10ms | Small partition scan |
| 10,000 ratings | 20–50ms | Larger partition scan |
| Cache hit | < 1ms | Skip DB entirely |

### Related Endpoints

- [POST /api/v1/videos/{id}/rating](/services/video-catalog/post-rating/) - Submit a rating
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Full video details
- [GET /api/v1/videos/{id}/related](/services/video-catalog/get-related/) - Related videos (uses ratings as signal)

## Further Learning

- [Cassandra Aggregate Functions](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_reference/cqlSelect.html#Aggregatefunctions)
- [Intra-Partition Aggregation](https://www.datastax.com/blog/cassandra-data-modeling-aggregation)
- [Bayesian Average Ratings](https://www.evanmiller.org/bayesian-average-ratings.html)
