---
title: "POST /api/v1/videos/id/{video_id}/rating"
description: "Submit a 1–5 star rating for a video with upsert semantics"
endpoint: "/api/v1/videos/id/{video_id}/rating"
method: "POST"
spec_artifact: "/services/video-catalog/_specs/post-rating.spec.md"
concepts:
  - upsert-semantics
  - rating-storage
  - composite-partition-key
  - idempotent-writes
order: 11
draft: true
---

# POST /api/v1/videos/id/{video_id}/rating - Rate a Video

## Overview

This endpoint allows an authenticated viewer to submit a star rating (1–5) for a video. If the user has already rated the video, their previous rating is **replaced** (upsert semantics). The response is 204 No Content — the rating is recorded but there is nothing meaningful to return.

**Why it exists**: Ratings are a core engagement metric and a signal for recommendation systems. The upsert pattern ensures each user has exactly one rating per video, regardless of how many times they call the endpoint.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos/id/{video_id}/rating`
- **Auth Required**: Yes — viewer role
- **Success Status**: 204 No Content

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to rate |

### Request Body

```json
{
  "rating": 4
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `rating` | integer | Yes | 1 to 5 inclusive |

### Response

```http
HTTP/1.1 204 No Content
```

No response body.

## Cassandra Concepts Explained

### Upsert Semantics

In Cassandra, `INSERT` and `UPDATE` behave identically when the primary key already exists — both operations **replace** (or merge) the row. This is the "upsert" (update-or-insert) pattern:

```cql
-- Whether the row exists or not, this writes the new value
INSERT INTO killrvideo.video_ratings (videoid, userid, rating)
VALUES (?, ?, ?);
```

This is different from SQL where you might need:
```sql
INSERT INTO video_ratings (...) VALUES (...)
ON CONFLICT (videoid, userid) DO UPDATE SET rating = ?;
```

In Cassandra, the upsert behavior is the default — no special syntax needed. The partition + clustering key determines uniqueness.

### Composite Partition Key vs. Compound Primary Key

The ratings table uses `(videoid, userid)` as a composite primary key. This means:
- `videoid` is the partition key: all ratings for a video are on the same node
- `userid` is the clustering column: ratings within a video partition are sorted/accessed by user

**Why this structure?**
- Fast lookup: "Did this user rate this video?" is a direct partition + clustering key lookup
- Fast aggregate: "What are all ratings for this video?" reads a single partition
- Bounded partitions: A video with 10,000 raters has a 10,000-row partition (manageable)

```
Partition for videoid=550e...
  userid=a1b2...  rating=4
  userid=c3d4...  rating=5
  userid=e5f6...  rating=2
```

### Idempotent Writes

Because the write is an upsert by primary key, calling this endpoint multiple times with the same `(video_id, user_id, rating)` is **idempotent** — the result is the same as calling it once. This is a valuable property:
- Network retries are safe
- Duplicate submissions don't create inconsistencies
- The user always ends up with exactly one rating per video

## Data Model

### Table: `video_ratings`

```cql
CREATE TABLE killrvideo.video_ratings (
    videoid uuid,    -- Partition key
    userid  uuid,    -- Clustering column
    rating  int,     -- 1–5
    rated_date timestamp,
    PRIMARY KEY ((videoid), userid)
);
```

**Key characteristics**:
- **Partition Key**: `videoid` — all ratings for a video are co-located
- **Clustering Column**: `userid` — within the video partition, each user has one row
- **Bounded**: Partition size = number of unique raters for the video

## Database Queries

### Upsert Rating

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.video_ratings (videoid, userid, rating, rated_date)
VALUES (
    550e8400-e29b-41d4-a716-446655440000,
    a1b2c3d4-e5f6-7890-abcd-ef1234567890,
    4,
    '2025-10-31T14:22:15Z'
);
```

This single statement handles both "first time rating" and "changing an existing rating."

**Performance**: O(1) — single partition write. Extremely fast.

### Check if User Already Rated (optional pre-check)

If the business logic requires special handling when a user changes their rating:
```cql
SELECT rating FROM killrvideo.video_ratings
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000
  AND userid = a1b2c3d4-e5f6-7890-abcd-ef1234567890;
```

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos/id/{video_id}/rating │
│    with JWT and { "rating": 4 }                          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Authenticate: verify JWT, extract userId              │
│    └─ Invalid/missing JWT? → 401 Unauthorized            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Validate request                                      │
│    ├─ video_id is valid UUID? → proceed                  │
│    ├─ rating in [1..5]? → proceed                        │
│    └─ Invalid? → 422 Validation Error                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Upsert: INSERT INTO video_ratings                     │
│    (videoid, userid, rating, rated_date)                 │
│    VALUES (?, ?, ?, now())                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Return 204 No Content                                 │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 INSERT (upsert)
**Expected latency**: < 10ms

## Special Notes

### 1. Rating 0 Is Invalid

The constraint is `1 ≤ rating ≤ 5`. Zero is not a valid rating (it would conventionally mean "unrated"). Submitting 0 should return a 422 Validation Error.

### 2. No Video Existence Check

The endpoint does not verify that the video exists before inserting the rating row. An insert for a non-existent video creates an orphaned row in `video_ratings`. This is generally acceptable:
- Performance: avoiding an extra SELECT keeps this fast
- Correctness: orphaned ratings are ignored when the video doesn't exist

A stricter implementation would validate video existence and return 404 if not found.

### 3. Rating Aggregates Are Computed Separately

This endpoint stores the raw rating. Computing the average and count is the job of [GET /api/v1/videos/{id}/rating](/services/video-catalog/get-rating/), which queries the `video_ratings` partition and aggregates in the application.

An alternative would maintain a summary in a separate table updated atomically, but for a learning platform the on-demand aggregation is sufficient.

### 4. Only Authenticated Users Can Rate

The `viewer` role check ensures anonymous users cannot flood ratings. A viewer must have an account, which provides a natural spam deterrent.

### 5. Rating History

The current schema stores only the most recent rating. The upsert replaces `rated_date` along with `rating`, so you can see when the user last rated but not their full history of changes. If rating history is needed, use a separate audit table with a time-based clustering column.

## Developer Tips

### Common Pitfalls

1. **Validating 0 as a valid "no rating" signal**: 0 is not a valid rating value here. Return 422 for any value outside [1..5].

2. **Forgetting to update rated_date on re-rating**: The INSERT upsert should always update `rated_date` to the current timestamp.

3. **Building a separate "check and insert" flow**: The Cassandra upsert is atomic and does not need a pre-read. Don't complicate it.

4. **Exposing the authenticated userId in the URL**: The user ID comes from the JWT, not the URL. Never let a client specify "rate as user X."

### Best Practices

1. **Normalize rating to integer on arrival**: Don't accept floats (4.5 stars). Define the contract strictly.

2. **Return 204, not 200**: There is nothing meaningful to return from a write-only action.

3. **Emit an event on rating**: Downstream recommendation services can consume rating events to improve suggestions.

4. **Consider rate limiting**: A single user should not be able to submit 1000 ratings per second.

### Performance Expectations

| Operation | Latency | Notes |
|-----------|---------|-------|
| Rating insert/upsert | < 5ms | Single partition write |
| Rating change (re-upsert) | < 5ms | Same as first insert |

### Related Endpoints

- [GET /api/v1/videos/{id}/rating](/services/video-catalog/get-rating/) - Fetch average rating summary
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Full video details
- [POST /api/v1/videos/{id}/view](/services/video-catalog/post-view/) - Similar 204 fire-and-forget pattern

## Further Learning

- [Cassandra Upsert Semantics](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useInsertLWT.html)
- [Idempotent Operations](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent)
- [Star Ratings Data Model](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-queries.html)
