---
title: "GET /api/v1/videos/{video_id}/ratings"
description: "Get the aggregate rating for a video, with optional user-specific rating"
endpoint: "/api/v1/videos/{video_id}/ratings"
method: "GET"
spec_artifact: "/services/comments-ratings/_specs/get-ratings.spec.md"
concepts:
  - counter-aggregation
  - optional-authentication
  - average-calculation
  - composite-keys
order: 6
draft: true
---

# GET /api/v1/videos/{video_id}/ratings - Video Rating Summary

## Overview

This endpoint returns the aggregate rating information for a video: the average rating and total number of raters. If a valid authentication token is provided, the response also includes the current user's personal rating, enabling the UI to display a filled star on whatever score the viewer has already submitted.

**Why it exists**: Displaying a star rating on a video requires two distinct pieces of information — the aggregate (visible to everyone) and the personal rating (visible only to the authenticated user). This endpoint handles both in a single request, adapting its response based on whether auth is present.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/{video_id}/ratings`
- **Auth Required**: No — but optional. Authenticated viewers receive `currentUserRating` in the response.
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to retrieve ratings for |

### Response Body (unauthenticated)

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "averageRating": 4.2,
  "totalRatingsCount": 137
}
```

### Response Body (authenticated viewer)

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "averageRating": 4.2,
  "totalRatingsCount": 137,
  "currentUserRating": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | UUID | The video |
| `averageRating` | float | Mean rating (rating_total / rating_counter), null if no ratings |
| `totalRatingsCount` | integer | Number of users who have rated the video |
| `currentUserRating` | integer \| null | This user's rating, or null if not yet rated (only present when authenticated) |

## Cassandra Concepts Explained

### Counter-Based Aggregation

Cassandra is not designed for aggregation queries like `AVG()` or `SUM()` across large data sets. Running:

```cql
-- Avoid this on large datasets — scans entire partition
SELECT AVG(rating) FROM killrvideo.video_ratings_by_user WHERE videoid = ?;
```

...works for small numbers of ratings but becomes progressively slower as ratings grow. A popular video with 100,000 ratings would require reading 100,000 rows to compute the average on every page load.

The solution is to **maintain running aggregates at write time** using Cassandra counter columns:

```cql
-- O(1) — read two counter values
SELECT rating_counter, rating_total FROM killrvideo.video_rating_counters
WHERE videoid = ?;

-- Average = rating_total / rating_counter
```

This trades a tiny amount of write complexity (incrementing counters on every rating submission) for extremely fast reads. The average is always pre-computed; the read endpoint just divides two numbers.

### Counter Column Mechanics

A counter column supports only atomic `+=` and `-=` operations:

```cql
-- Valid: atomic increment
UPDATE killrvideo.video_rating_counters
SET rating_counter = rating_counter + 1,
    rating_total   = rating_total + 4
WHERE videoid = ?;

-- Invalid: cannot SET a counter to an absolute value
UPDATE killrvideo.video_rating_counters
SET rating_counter = 137  -- This will fail
WHERE videoid = ?;
```

Counter increments are applied atomically. Multiple concurrent writers can safely increment the same counter without losing updates — Cassandra uses a special counter reconciliation mechanism to handle this.

**Trade-off**: Counters cannot be reset to a specific value. If the counter becomes wrong (e.g., due to the non-atomic dual-write in the POST endpoint), correcting it requires incrementing/decrementing by the known delta, not setting an absolute value.

### Optional Authentication Pattern

Most endpoints either require auth (and return 401 without it) or don't check auth at all. This endpoint implements a third pattern: **optional auth**.

The behavior is:
1. Try to decode the JWT from the `Authorization` header
2. If present and valid: include `currentUserRating` in the response
3. If absent or invalid: return only aggregate data (no 401 error)

This is appropriate when auth enriches the response but is not required for the core functionality. The implementation must avoid blocking the request if the auth header is malformed or expired — it should silently fall back to the unauthenticated response shape.

### Average Calculation at Read Time

```python
average = rating_total / rating_counter if rating_counter > 0 else None
```

Dividing at read time (rather than storing the average) has advantages:
- Counters are always integer values — no floating-point storage issues
- The average is as precise as needed (computed with Python float arithmetic)
- No need to update a stored average on every rating change

## Data Model

### Table: `video_rating_counters`

```cql
CREATE TABLE killrvideo.video_rating_counters (
    videoid        uuid PRIMARY KEY,
    rating_counter counter,   -- total number of raters
    rating_total   counter    -- sum of all rating values
);
```

**Read query for aggregate**:
```cql
SELECT rating_counter, rating_total
FROM killrvideo.video_rating_counters
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

### Table: `video_ratings_by_user`

```cql
CREATE TABLE killrvideo.video_ratings_by_user (
    videoid    uuid,
    userid     uuid,
    rating     int,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (videoid, userid)
);
```

**Read query for personal rating**:
```cql
SELECT rating FROM killrvideo.video_ratings_by_user
WHERE videoid = ? AND userid = ?;
```

## Database Queries

### 1. Fetch Rating Counters

```python
async def get_rating_counters(video_id: UUID):
    table = await get_table("video_rating_counters")
    return await table.find_one(
        filter={"videoid": str(video_id)}
    )
```

**Equivalent CQL**:
```cql
SELECT rating_counter, rating_total
FROM killrvideo.video_rating_counters
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: O(1) — single partition key lookup.

**If no row exists**: The video has received no ratings yet. Return `averageRating: null, totalRatingsCount: 0`.

### 2. Fetch User's Personal Rating (if authenticated)

```python
async def get_user_rating(video_id: UUID, user_id: UUID):
    table = await get_table("video_ratings_by_user")
    row = await table.find_one(
        filter={"videoid": str(video_id), "userid": str(user_id)}
    )
    return row["rating"] if row else None
```

**Equivalent CQL**:
```cql
SELECT rating FROM killrvideo.video_ratings_by_user
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000
AND userid = 7f3e1a2b-dead-beef-cafe-123456789abc;
```

**Performance**: O(1) — exact composite key lookup.

### 3. Compute Average in Application Layer

```python
if counters and counters["rating_counter"] > 0:
    average_rating = counters["rating_total"] / counters["rating_counter"]
    total_count = counters["rating_counter"]
else:
    average_rating = None
    total_count = 0
```

**Why in the application layer**: Cassandra counter arithmetic gives integer results. Division with a float result is better handled in the application.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/{video_id}/ratings    │
│    Optional: Authorization: Bearer <jwt>                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Try to decode JWT (optional)                          │
│    ├─ Valid token: extract userid                        │
│    └─ Missing/invalid: set userid = None (no error)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate video_id path parameter                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Fetch from video_rating_counters (always)             │
│    └─ rating_counter, rating_total                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. If authenticated: fetch from video_ratings_by_user    │
│    WHERE videoid = ? AND userid = ?                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Compute averageRating = rating_total / rating_counter │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 200 OK                                         │
│    { videoId, averageRating, totalRatingsCount,          │
│      currentUserRating? }                                │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Counter Accuracy

The counter values in `video_rating_counters` are maintained by the POST /ratings endpoint. Because that endpoint's dual-write (rating row + counter update) is not atomic, the counters may occasionally be off by one or slightly more in high-concurrency scenarios.

**Practical impact**: The displayed average may be slightly wrong for a brief period after a rating update. This is not a critical failure for a video rating feature.

### 2. Division by Zero Guard

If `rating_counter` is 0 (no ratings yet), the application must guard against division by zero. Return `averageRating: null` and `totalRatingsCount: 0` to indicate the video has not been rated.

### 3. Response Shape Varies by Auth State

The response includes `currentUserRating` only when a valid auth token is present. UI code must handle both shapes. The field is absent (not `null`) when unauthenticated — this is a deliberate design to avoid ambiguity between "not rated" and "not authenticated."

### 4. No 404 for Unrated Videos

If a video has never been rated, no row exists in `video_rating_counters`. The endpoint returns 200 with `{ averageRating: null, totalRatingsCount: 0 }` rather than 404. A missing rating aggregate is a valid state, not an error.

## Developer Tips

### Common Pitfalls

1. **Not guarding against null/missing counter row**: The first time anyone rates a video, the counter row is created. Before that, a `find_one` on `video_rating_counters` returns null. Always check for this case.

2. **Trying to SET counter values**: Counter columns cannot be assigned absolute values. If you need to correct a counter, compute the delta and apply it with +=.

3. **Exposing `currentUserRating` when not authenticated**: Returning this field with a null value when unauthenticated is confusing. Omit the field entirely for unauthenticated responses.

4. **Rounding the average inconsistently**: Decide on a rounding strategy (e.g., 1 decimal place) and apply it consistently in the service layer, not in the database.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch counter row | **< 5ms** | Partition key lookup, single row |
| Fetch user rating | **< 5ms** | Composite key exact lookup |
| Average computation | **< 1ms** | In-memory arithmetic |
| Total (authenticated) | **< 15ms** | Two parallel lookups + computation |
| Total (unauthenticated) | **< 8ms** | One lookup + computation |

### Testing Tips

```python
async def test_rating_aggregate_unauthenticated():
    # Unauthenticated: no currentUserRating field
    response = await client.get(f"/api/v1/videos/{video_id}/ratings")
    assert response.status_code == 200
    data = response.json()
    assert "currentUserRating" not in data

async def test_rating_aggregate_authenticated():
    # Submit a rating
    await client.post(
        f"/api/v1/videos/{video_id}/ratings",
        json={"rating": 4},
        headers={"Authorization": f"Bearer {token}"}
    )

    # Authenticated response includes personal rating
    response = await client.get(
        f"/api/v1/videos/{video_id}/ratings",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["currentUserRating"] == 4
    assert data["totalRatingsCount"] >= 1
    assert data["averageRating"] is not None

async def test_no_ratings_returns_null_average():
    response = await client.get(f"/api/v1/videos/{unrated_video_id}/ratings")
    assert response.status_code == 200
    data = response.json()
    assert data["averageRating"] is None
    assert data["totalRatingsCount"] == 0
```

## Related Endpoints

- [POST /api/v1/videos/{video_id}/ratings](/services/comments-ratings/post-rating/) - Submit or update a rating
- [GET /api/v1/videos/{video_id}/comments](/services/comments-ratings/get-video-comments/) - Comments on the same video

## Further Learning

- [Cassandra Counter Type](https://docs.datastax.com/en/cql-oss/3.3/cql/cql_reference/counter_type.html)
- [Cassandra Lightweight Transactions](https://cassandra.apache.org/doc/latest/cassandra/cql/dml.html#batch)
- [Optional Auth in FastAPI](https://fastapi.tiangolo.com/advanced/security/http-basic-auth/)
