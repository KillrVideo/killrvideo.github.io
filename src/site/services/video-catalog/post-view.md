---
title: "POST /api/v1/videos/id/{video_id}/view"
description: "Increment the view counter for a video using Cassandra counters"
endpoint: "/api/v1/videos/id/{video_id}/view"
method: "POST"
spec_artifact: "/services/video-catalog/_specs/post-view.spec.md"
concepts:
  - counter-columns
  - atomic-increments
  - eventual-consistency
  - write-only-counters
order: 5
draft: true
---

# POST /api/v1/videos/id/{video_id}/view - Record a View

## Overview

This endpoint increments the view count for a video by one. It returns 204 No Content — a deliberate choice because there's nothing meaningful to return. Under the hood, it uses Cassandra's **counter column type**, which provides lock-free atomic increments across a distributed cluster.

**Why it exists**: View counts are a key engagement metric. Accurate, high-frequency incrementing requires a data model built specifically for concurrent writes — Cassandra counters are ideal for this.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos/id/{video_id}/view`
- **Auth Required**: No (public endpoint — any visitor can generate a view)
- **Success Status**: 204 No Content

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to record a view for |

### Request

```http
POST /api/v1/videos/id/550e8400-e29b-41d4-a716-446655440000/view
```

No request body.

### Response

```http
HTTP/1.1 204 No Content
```

No response body.

## Cassandra Concepts Explained

### Counter Columns

A Cassandra **counter** is a special column type that supports only one operation: `counter = counter + N`. You cannot set it to an arbitrary value, and you cannot read-then-write it atomically (unlike most languages' `++` operator).

```cql
-- This is the ONLY valid write operation:
UPDATE killrvideo.videos
SET views = views + 1
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Why this is powerful**:
- Every Cassandra node can process a counter increment simultaneously
- No locking, no coordination between nodes needed
- The cluster resolves concurrent increments through a conflict-free merge
- Even if two nodes each receive a `+1` at the same moment, the result converges to `+2`

### Why Counters Don't Need Locks

Traditional databases increment a counter like this:
```
1. READ current value (e.g., 1000)
2. ADD 1 → 1001
3. WRITE 1001 back
```

With concurrent users, two threads might both read 1000, both compute 1001, and both write 1001 — losing a count. This requires row-level locking.

Cassandra counter cells work differently:
- Each replica tracks its own "delta" (how much it has incremented locally)
- The true value is the **sum of all replica deltas**
- No read-before-write, no locking needed

This design sacrifices the ability to set exact values in exchange for perfect concurrent write performance.

### Eventual Consistency for Counters

Counter reads in Cassandra are eventually consistent. If you increment and immediately read, you might see the pre-increment value for a moment. For view counts, this is perfectly acceptable — viewers don't need to see exact real-time counts.

### 204 No Content

HTTP 204 is the correct response when an action succeeds but there is nothing useful to return. Incrementing a counter has no meaningful return value — the caller doesn't need to know the new count to proceed.

## Data Model

### Table: `videos` (with counter column)

```cql
CREATE TABLE killrvideo.videos (
    videoid                 uuid PRIMARY KEY,
    userid                  uuid,
    name                    text,
    description             text,
    location                text,
    preview_image_location  text,
    tags                    set<text>,
    added_date              timestamp,
    views                   counter,    -- ← counter column
    status                  text
);
```

**Important constraint**: In standard CQL, a table with counter columns must have **only** counter columns (aside from the primary key). Cassandra 5 / Astra DB Data API blends this by storing counters differently — the `videos` table uses a `$inc` operator pattern at the API level.

### The `$inc` Operator Pattern

When using the Astra Data API, counter increments are expressed as:

```json
{
  "$inc": { "views": 1 }
}
```

This is analogous to MongoDB's `$inc` operator — it tells the Data API layer to issue a counter increment at the Cassandra level, not an overwrite.

## Database Queries

### Increment View Count

**Equivalent CQL**:
```cql
UPDATE killrvideo.videos
SET views = views + 1
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Data API equivalent**:
```json
PATCH /v1/{namespace}/videos
filter: { "videoid": "550e8400-e29b-41d4-a716-446655440000" }
update: { "$inc": { "views": 1 } }
```

**Performance**: O(1) — single-partition write, extremely fast.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos/id/{video_id}/view   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. FastAPI validates UUID format of video_id             │
│    ├─ Invalid format? → 422 Validation Error             │
│    └─ Valid UUID? → Continue                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Issue UPDATE videos SET views = views + 1             │
│    WHERE videoid = video_id                              │
│    (No read required — fire-and-forget increment)        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Return 204 No Content                                 │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 UPDATE
**Expected latency**: < 5ms

## Special Notes

### 1. No "Video Must Exist" Check

The endpoint does **not** verify that the video ID is valid before issuing the increment. This is a deliberate performance trade-off — checking existence requires an extra read, and view counts on non-existent videos are harmless (there is nothing to display them on).

A production system might validate the ID if it needs to return 404 for invalid videos, but for pure analytics this is often skipped.

### 2. View Count Inflation

Anyone can call this endpoint as many times as they want. There is no rate limiting or deduplication in the current implementation. Production platforms typically:
- Track IP addresses or user IDs in a separate cache (Redis) with a TTL
- Only count one view per user per video per hour
- Use client-side logic to avoid calling the endpoint on every frame render

### 3. Counter Accuracy Trade-offs

Cassandra counters can occasionally "miss" increments in failure scenarios (network partitions, node restarts). For view counts, losing 1 in 10,000 is acceptable. For financial data, counters are not appropriate.

### 4. The `views` Field in Responses

When clients fetch a video via [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/), the `views` count may lag slightly behind reality due to eventual consistency. This is expected and normal.

### 5. Counter vs. Time-Series Events

Another approach is to write a "view event" row to a time-series table (one row per view, timestamped). This gives you historical analytics but is far more storage-intensive. Cassandra counters are the right choice when you need only the aggregate number.

## Developer Tips

### Common Pitfalls

1. **Trying to set counters to a specific value**: `SET views = 100` is invalid in CQL. You can only increment (`+N`) or decrement (`-N`).

2. **Reading before writing**: There is no need to read the current view count before incrementing. The `UPDATE ... SET views = views + 1` is atomic at the Cassandra level.

3. **Expecting immediate consistency**: After a `POST /view`, the `GET /video` might still show the old count. This is expected — use eventual consistency as a feature, not a bug.

4. **Counter columns mixed with non-counter columns (raw CQL)**: In raw CQL, a table cannot mix counter and non-counter columns. The Data API abstraction handles this transparently.

### Best Practices

1. **Rate limit at the API gateway**: Prevent a single client from sending millions of view requests. Use a token bucket or leaky bucket algorithm.

2. **Track unique views separately if needed**: Store `(userid, videoid)` in a separate set-based table to deduplicate views per user.

3. **Use 204 consistently for side-effect-only actions**: Incrementing a counter, sending a notification, marking something as read — all good candidates for 204.

4. **Fire and forget is fine**: Don't wait for confirmation from the counter write before responding. Cassandra's write path is durable once acknowledged.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Single view increment | < 5ms | One partition write |
| 10,000 concurrent increments | < 10ms per request | Cassandra counters scale linearly |

### Related Endpoints

- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Fetch video including view count
- [POST /api/v1/videos/{id}/rating](/services/video-catalog/post-rating/) - Similar fire-and-forget pattern for ratings

## Further Learning

- [Cassandra Counter Columns](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useCounters.html)
- [HTTP 204 No Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204)
- [Eventual Consistency Explained](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html)
- [Rate Limiting Strategies](https://www.nginx.com/blog/rate-limiting-nginx/)
