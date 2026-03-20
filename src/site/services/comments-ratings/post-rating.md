---
title: "POST /api/v1/videos/{video_id}/ratings"
description: "Submit or update a rating for a video"
endpoint: "/api/v1/videos/{video_id}/ratings"
method: "POST"
spec_artifact: "/services/comments-ratings/_specs/post-rating.spec.md"
concepts:
  - upsert-semantics
  - counter-tables
  - composite-keys
  - rating-aggregation
order: 5
draft: true
---

# POST /api/v1/videos/{video_id}/ratings - Rate a Video

## Overview

This endpoint allows an authenticated viewer to submit a 1–5 star rating for a video. If the user has already rated the video, their existing rating is updated (upsert semantics). After recording the individual rating, the endpoint updates a counter-based aggregate so that the average rating can be read efficiently without scanning all individual ratings.

**Why it exists**: Ratings require two complementary data structures: one to remember what each user rated (for personalization and to enable updates), and one to maintain a running aggregate (for fast retrieval of the current average). This endpoint writes to both.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos/{video_id}/ratings`
- **Auth Required**: Yes — viewer role (JWT bearer token)
- **Success Status**: 200 OK

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

| Field | Type | Constraints |
|-------|------|-------------|
| `rating` | integer | 1–5, required |

### Response Body

```json
{
  "rating": 4,
  "videoid": "550e8400-e29b-41d4-a716-446655440000",
  "userid": "7f3e1a2b-dead-beef-cafe-123456789abc",
  "created_at": "2025-10-31T10:30:00Z",
  "updated_at": "2025-11-01T14:22:00Z"
}
```

## Cassandra Concepts Explained

### Upsert Semantics

In SQL databases, you typically use separate INSERT and UPDATE statements, or a database-specific `UPSERT` / `MERGE` construct. Cassandra handles this more elegantly:

Every `INSERT` in Cassandra is inherently an **upsert**. If a row with the same primary key already exists, the INSERT updates the existing row's columns. If no row exists, it is created.

For ratings, this means:
- A user's first rating creates a new row in `video_ratings_by_user`
- A user's second (updated) rating updates the existing row in place
- The application does not need to check for existence before writing

```cql
-- This creates or updates — no need for separate INSERT/UPDATE logic
INSERT INTO killrvideo.video_ratings_by_user
    (videoid, userid, rating, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);
```

### Counter Tables

Cassandra has a special `COUNTER` data type for columns that need atomic increment/decrement operations. A counter column is the only column type that can be updated with arithmetic (+=, -=) rather than a full value replacement.

For ratings, we maintain:
- `rating_counter`: total number of ratings submitted
- `rating_total`: sum of all rating values (for average calculation)

The average rating is then `rating_total / rating_counter`, computed at read time.

**Why counters instead of re-computing from individual rows?**
- `comments_by_video` might have millions of rating rows for popular videos
- Scanning all of them to compute an average on every read would be extremely slow
- Counters update atomically in O(1) time

**Limitation**: Counter columns cannot be mixed with regular columns in the same table. A dedicated `video_rating_counters` table stores only counter data.

### Composite Primary Keys for Per-User Ratings

The `video_ratings_by_user` table uses a composite primary key:

```cql
PRIMARY KEY (videoid, userid)
```

- **Partition key**: `videoid` — all ratings for one video in one partition
- **Clustering key**: `userid` — individual user's rating within that partition

This design answers two queries efficiently:
1. "Has this user rated this video?" — exact lookup by (videoid, userid)
2. "What did all users rate this video?" — range scan within the videoid partition

### Rating Update and Aggregate Consistency

When a user *updates* their rating (e.g., changes from 3 to 5), the aggregate counters must be adjusted:

```
new_rating_total = rating_total - old_rating + new_rating
```

The `rating_counter` stays the same (still one rating per user). Only `rating_total` changes.

This requires reading the old rating first, then computing the delta. Because this read-modify-write is not atomic in Cassandra, there is a small window for inconsistency under concurrent updates from the same user. In practice, concurrent self-updates are rare enough that this is acceptable.

## Data Model

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

**Key Characteristics**:
- **Composite Key**: `(videoid, userid)` — one row per (video, user) pair
- **Upsert**: Repeated inserts with the same key update the existing row
- **created_at vs updated_at**: `created_at` is set once at first insert; `updated_at` changes on every write

### Table: `video_rating_counters`

```cql
CREATE TABLE killrvideo.video_rating_counters (
    videoid       uuid PRIMARY KEY,
    rating_counter counter,   -- number of ratings
    rating_total   counter    -- sum of all rating values
);
```

**Key Characteristics**:
- **Counter columns**: Use `UPDATE ... SET rating_counter = rating_counter + 1`
- **Cannot mix with regular columns**: Counter tables store only the partition key and counter columns
- **Atomic**: Counter updates are safe under concurrency

## Database Queries

### 1. Check for Existing Rating

```python
async def get_existing_rating(video_id: UUID, user_id: UUID):
    table = await get_table("video_ratings_by_user")
    return await table.find_one(
        filter={"videoid": str(video_id), "userid": str(user_id)}
    )
```

**Equivalent CQL**:
```cql
SELECT rating, created_at FROM killrvideo.video_ratings_by_user
WHERE videoid = ? AND userid = ?;
```

**Performance**: O(1) — exact composite key lookup.

### 2. Upsert Individual Rating

```python
now = datetime.now(timezone.utc).isoformat()

await ratings_table.find_one_and_replace(
    filter={"videoid": str(video_id), "userid": str(user_id)},
    replacement={
        "videoid":    str(video_id),
        "userid":     str(user_id),
        "rating":     body.rating,
        "created_at": existing["created_at"] if existing else now,
        "updated_at": now
    },
    upsert=True
)
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.video_ratings_by_user
    (videoid, userid, rating, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);
```

### 3. Update Rating Aggregate Counters

```python
delta = body.rating  # For new ratings
if existing:
    delta = body.rating - existing["rating"]  # For updates

# Increment counter by delta for rating_total
# For new ratings, also increment rating_counter by 1
await counters_table.find_one_and_update(
    filter={"videoid": str(video_id)},
    update={
        "$inc": {
            "rating_total": delta,
            "rating_counter": 0 if existing else 1
        }
    },
    upsert=True
)
```

**Equivalent CQL** (new rating):
```cql
UPDATE killrvideo.video_rating_counters
SET rating_counter = rating_counter + 1,
    rating_total   = rating_total + 4
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Equivalent CQL** (updated rating, old=3, new=5):
```cql
UPDATE killrvideo.video_rating_counters
SET rating_total = rating_total + 2  -- delta: 5 - 3 = 2
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
-- rating_counter stays the same
```

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos/{video_id}/ratings   │
│    Header: Authorization: Bearer <jwt>                   │
│    Body: { "rating": 4 }                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. JWT middleware validates token, extracts userid       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate request body (rating: 1–5)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Read existing rating for (videoid, userid)            │
│    └─ Determines if this is a new rating or an update    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Upsert into video_ratings_by_user                     │
│    ├─ New rating: set created_at = now                   │
│    └─ Update: preserve created_at, update updated_at     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Update video_rating_counters                          │
│    ├─ New rating: rating_counter += 1, rating_total += N │
│    └─ Update: rating_total += (new - old)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 200 OK                                         │
│    { rating, videoid, userid, created_at, updated_at }   │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Counter Update is Not Atomic with Rating Insert

The upsert into `video_ratings_by_user` and the update to `video_rating_counters` are two separate operations. If the counter update fails after the rating insert succeeds, the aggregate will be wrong.

**Impact**: The average rating displayed to users will be slightly off until the inconsistency is resolved. For a rating feature, this is usually acceptable — a brief discrepancy in the displayed average is not a critical failure.

**Mitigation**: Background reconciliation can periodically recount from `video_ratings_by_user` and correct the counters.

### 2. Rating Range Enforcement

The 1–5 constraint is enforced at the API layer. Cassandra stores this as an `int` with no range constraint. Bypassing the API layer would allow storing out-of-range values, which would corrupt the average calculation.

### 3. 200 vs 201 Status Code

This endpoint returns 200 (not 201) because the operation is an upsert — it may be creating a new rating or updating an existing one. A 201 would imply that a new resource was always created, which is not guaranteed.

### 4. Idempotency

Submitting the same rating value twice produces no net change to the aggregates (delta = 0 for the counter update). The response remains the same. This makes the endpoint effectively idempotent for identical inputs.

## Developer Tips

### Common Pitfalls

1. **Not reading the old rating before updating**: Without the old value, you cannot compute the correct delta for `rating_total`. Always read first if an existing rating might exist.

2. **Using regular columns for running totals**: Regular column updates replace the value — they are not safe under concurrent writes. Use counter columns for values that multiple writers might increment simultaneously.

3. **Mixing counter and non-counter columns in one table**: Cassandra will reject this. Keep `video_rating_counters` as a counter-only table.

4. **Expecting the average to always be exactly correct**: The two-step write (rating + counter) is not atomic. Accept small, temporary inconsistencies.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Read existing rating | **< 5ms** | Exact composite key lookup |
| Upsert rating | **< 10ms** | Single partition write |
| Update counters | **< 10ms** | Counter update, single partition |
| Total | **< 30ms** | Sequential read + two writes |

### Testing Tips

```python
async def test_rating_update_adjusts_aggregate():
    # First rating
    resp1 = await client.post(
        f"/api/v1/videos/{video_id}/ratings",
        json={"rating": 3},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp1.status_code == 200

    agg1 = await client.get(f"/api/v1/videos/{video_id}/ratings")
    assert agg1.json()["totalRatingsCount"] == 1
    assert agg1.json()["averageRating"] == 3.0

    # Update rating
    resp2 = await client.post(
        f"/api/v1/videos/{video_id}/ratings",
        json={"rating": 5},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp2.status_code == 200

    agg2 = await client.get(f"/api/v1/videos/{video_id}/ratings")
    assert agg2.json()["totalRatingsCount"] == 1  # Still one rater
    assert agg2.json()["averageRating"] == 5.0   # Average updated
```

## Related Endpoints

- [GET /api/v1/videos/{video_id}/ratings](/services/comments-ratings/get-ratings/) - Read the aggregate rating
- [POST /api/v1/videos/{video_id}/comments](/services/comments-ratings/post-comment/) - Add a comment to the same video

## Further Learning

- [Cassandra Counter Columns](https://docs.datastax.com/en/cql-oss/3.3/cql/cql_reference/counter_type.html)
- [Cassandra Upsert (INSERT ... IF NOT EXISTS)](https://cassandra.apache.org/doc/latest/cassandra/cql/dml.html#insert)
- [Cassandra Data Modeling: Time Series](https://www.datastax.com/blog/basic-rules-cassandra-data-modeling)
