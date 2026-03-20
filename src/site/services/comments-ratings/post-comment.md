---
title: "POST /api/v1/videos/{video_id}/comments"
description: "Add a comment to a video"
endpoint: "/api/v1/videos/{video_id}/comments"
method: "POST"
spec_artifact: "/services/comments-ratings/_specs/post-comment.spec.md"
concepts:
  - timeuuid
  - dual-table-writes
  - clustering-keys
  - sentiment-analysis
order: 2
draft: true
---

# POST /api/v1/videos/{video_id}/comments - Add a Comment

## Overview

This endpoint lets an authenticated viewer post a comment on a video. It writes the comment into two separate Cassandra tables simultaneously—one organized by video and one organized by user—so that both "comments on a video" and "comments by a user" queries are fast. An optional sentiment analysis step scores the comment text before it is persisted.

**Why it exists**: Comments drive community engagement. Storing them in two tables is a deliberate Cassandra design decision: because Cassandra cannot efficiently filter across partition boundaries, we keep two physical copies of every comment so each query pattern has its own perfectly-shaped partition to hit.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos/{video_id}/comments`
- **Auth Required**: Yes — viewer role (JWT bearer token)
- **Success Status**: 201 Created

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video receiving the comment |

### Request Body

```json
{
  "text": "This tutorial finally made clustering keys click for me!"
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `text` | string | 1–1000 characters, required |

### Response Body

```json
{
  "commentid": "a3b4c5d6-0000-11ee-be56-0242ac120002",
  "videoid": "550e8400-e29b-41d4-a716-446655440000",
  "userid": "7f3e1a2b-dead-beef-cafe-123456789abc",
  "comment": "This tutorial finally made clustering keys click for me!",
  "sentiment_score": 0.87,
  "firstName": "Jane",
  "lastName": "Developer"
}
```

## Cassandra Concepts Explained

### What is a TimeUUID?

A **TimeUUID** (UUID version 1) encodes a timestamp directly inside the UUID value. The first 60 bits represent a 100-nanosecond-resolution timestamp, and the remaining bits add uniqueness to prevent collisions.

Why this matters for comments:
- Cassandra can **sort TimeUUIDs chronologically** using clustering key order
- You get a globally unique comment ID *and* a built-in timestamp in a single value
- No separate `created_at` column is needed for ordering (though you may still store one for human-readable display)

Compare UUID versions:

| Version | Source of uniqueness | Sortable by time? |
|---------|---------------------|-------------------|
| v1 (TimeUUID) | MAC address + timestamp | Yes |
| v4 (random) | Random bits | No |

### Clustering Keys and Sort Order

In Cassandra, the **clustering key** defines the order of rows *within* a partition. For comments:

```
PRIMARY KEY (videoid, commentid)
```

- `videoid` is the partition key — all comments for a video live on the same node
- `commentid` is the clustering key — rows within that partition are sorted by this value
- Adding `WITH CLUSTERING ORDER BY (commentid DESC)` means newest comments come first

This is powerful because Cassandra's on-disk storage already keeps these rows in order. Fetching "the latest 20 comments" is a sequential read of the first 20 rows in the partition — no sort step needed.

### Dual-Table Writes (Denormalization)

Cassandra's golden rule: **model your tables around your queries**. This endpoint has two distinct access patterns:

1. "Show me comments on video X" → partition by `videoid`
2. "Show me comments by user Y" → partition by `userid`

Since Cassandra cannot efficiently join tables or filter across partitions, the solution is to write the same comment to two tables at insert time. This is **denormalization**: intentionally storing duplicate data to make reads fast.

**Trade-off**: Writes are slightly more expensive (two inserts instead of one), but reads for either pattern are O(1) partition lookups.

### Sentiment Analysis Integration

Before the comment is persisted, the service optionally scores the comment text using a sentiment analysis model. The resulting `sentiment_score` (a float between 0.0 and 1.0, where higher = more positive) is stored alongside the comment. This enriches the data model without requiring a separate enrichment pipeline after the fact.

## Data Model

### Table: `comments_by_video`

```cql
CREATE TABLE killrvideo.comments_by_video (
    videoid    uuid,
    commentid  timeuuid,
    userid     uuid,
    comment    text,
    sentiment_score float,
    PRIMARY KEY (videoid, commentid)
) WITH CLUSTERING ORDER BY (commentid DESC);
```

**Key Characteristics**:
- **Partition Key**: `videoid` — all comments for one video in one partition
- **Clustering Key**: `commentid DESC` — newest comments at the top
- **TimeUUID**: `commentid` encodes creation time, enabling ordered retrieval without a separate timestamp

### Table: `comments_by_user`

```cql
CREATE TABLE killrvideo.comments_by_user (
    userid     uuid,
    commentid  timeuuid,
    videoid    uuid,
    comment    text,
    sentiment_score float,
    PRIMARY KEY (userid, commentid)
) WITH CLUSTERING ORDER BY (commentid DESC);
```

**Key Characteristics**:
- **Partition Key**: `userid` — all comments by one user in one partition
- **Clustering Key**: Same `commentid DESC` ordering
- **Mirror of `comments_by_video`**: Same data, different partition key

## Database Queries

### 1. Generate a TimeUUID

```python
from uuid import uuid1

comment_id = uuid1()  # Timestamp-based UUID
```

**Why `uuid1()`**: The timestamp encoded inside v1 UUIDs lets Cassandra keep comment rows in chronological order automatically. Using `uuid4()` here would still work for uniqueness but would lose the ordering guarantee.

### 2. Score Sentiment (Optional)

```python
async def analyze_sentiment(text: str) -> float:
    # Calls an internal or external NLP service
    score = await sentiment_service.score(text)
    return score  # 0.0 (negative) to 1.0 (positive)
```

This step runs before the database writes. If the sentiment service is unavailable, the score can default to `null` so the comment write still succeeds.

### 3. Insert into `comments_by_video`

```python
await comments_by_video_table.insert_one({
    "videoid":         str(video_id),
    "commentid":       str(comment_id),
    "userid":          str(current_user.userid),
    "comment":         body.text,
    "sentiment_score": sentiment_score
})
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.comments_by_video
    (videoid, commentid, userid, comment, sentiment_score)
VALUES (
    550e8400-e29b-41d4-a716-446655440000,
    a3b4c5d6-0000-11ee-be56-0242ac120002,
    7f3e1a2b-dead-beef-cafe-123456789abc,
    'This tutorial finally made clustering keys click for me!',
    0.87
);
```

**Performance**: O(1) — single partition write, no index lookup required.

### 4. Insert into `comments_by_user`

```python
await comments_by_user_table.insert_one({
    "userid":          str(current_user.userid),
    "commentid":       str(comment_id),
    "videoid":         str(video_id),
    "comment":         body.text,
    "sentiment_score": sentiment_score
})
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.comments_by_user
    (userid, commentid, videoid, comment, sentiment_score)
VALUES (
    7f3e1a2b-dead-beef-cafe-123456789abc,
    a3b4c5d6-0000-11ee-be56-0242ac120002,
    550e8400-e29b-41d4-a716-446655440000,
    'This tutorial finally made clustering keys click for me!',
    0.87
);
```

**Performance**: O(1) — single partition write.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos/{video_id}/comments  │
│    Header: Authorization: Bearer <jwt>                   │
│    Body: { "text": "Great video!" }                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. JWT middleware validates token                        │
│    └─ Extracts current user (userid, firstName, lastName)│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate request body                                 │
│    └─ text: 1–1000 chars, required                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Generate commentid = uuid1() (TimeUUID)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Run sentiment analysis on comment text                │
│    └─ Returns score 0.0–1.0 (or null on failure)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Write to TWO tables (can run in parallel)             │
│    ├─ INSERT INTO comments_by_video                      │
│    └─ INSERT INTO comments_by_user                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 201 Created                                    │
│    { commentid, videoid, userid, comment,                │
│      sentiment_score, firstName, lastName }              │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. No Cassandra-Level Transaction Across Tables

The two INSERT statements are independent. Cassandra does not support multi-table ACID transactions. If the second insert fails after the first succeeds, the data will be inconsistent: the comment will appear in one view but not the other.

**Mitigation strategies**:
- Retry the failed insert (idempotent by nature — same `commentid` value)
- Accept that rare inconsistencies exist and handle them in read paths
- Use a background reconciliation job for production systems

### 2. TimeUUID Precision and Ordering

Because TimeUUIDs encode time at 100-nanosecond resolution, comments posted extremely close together (within the same process) might share the same timestamp bits. The MAC address component provides uniqueness in that case, but ordering between those rows is arbitrary. In practice, user-submitted comments are never close enough in time for this to matter.

### 3. Sentiment Score Availability

The `sentiment_score` field may be `null` if:
- The sentiment service is unavailable
- The comment text is too short or ambiguous for reliable scoring
- Sentiment analysis is disabled for the deployment

Callers should treat this field as optional in their UI.

### 4. Text Length Limit

The 1,000-character limit is enforced at the API layer by Pydantic validation. Cassandra's `text` type has no inherent length restriction — the limit is a product decision to keep partitions manageable and prevent abuse.

## Developer Tips

### Common Pitfalls

1. **Using `uuid4()` for commentid**: This works for uniqueness but loses chronological sort order. Use `uuid1()` for any clustering key that should be time-ordered.

2. **Writing to only one table**: Both tables must be populated. A comment visible on the video page but invisible on the user's profile (or vice versa) is a data consistency bug.

3. **Blocking on sentiment analysis**: If sentiment scoring is slow, run it concurrently with table preparation rather than sequentially.

4. **Large comment partitions**: A very popular video with millions of comments will have a very large partition. Consider time-bucketing (e.g., adding a `bucket` column derived from the month) if partition size becomes a concern.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Insert into comments_by_video | **< 10ms** | Single partition write |
| Insert into comments_by_user | **< 10ms** | Single partition write |
| Sentiment scoring | **< 50ms** | Depends on model/service |
| Total (writes in parallel) | **< 60ms** | Network + sentiment dominates |

### Testing Tips

When testing this endpoint, verify both table writes occurred:

```python
async def test_comment_writes_to_both_tables():
    response = await client.post(
        f"/api/v1/videos/{video_id}/comments",
        json={"text": "Test comment"},
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert "commentid" in data
    assert data["comment"] == "Test comment"

    # Verify the comment appears in video feed
    video_comments = await client.get(f"/api/v1/videos/{video_id}/comments")
    assert any(c["commentid"] == data["commentid"]
               for c in video_comments.json()["items"])

    # Verify the comment appears in user feed
    user_comments = await client.get(f"/api/v1/users/{user_id}/comments")
    assert any(c["commentid"] == data["commentid"]
               for c in user_comments.json()["items"])
```

## Related Endpoints

- [GET /api/v1/videos/{video_id}/comments](/services/comments-ratings/get-video-comments/) - Retrieve comments for a video
- [GET /api/v1/users/{user_id}/comments](/services/comments-ratings/get-user-comments/) - Retrieve all comments by a user
- [POST /api/v1/videos/{video_id}/ratings](/services/comments-ratings/post-rating/) - Rate a video

## Further Learning

- [Cassandra TimeUUID](https://docs.datastax.com/en/cql-oss/3.3/cql/cql_reference/timeuuid_functions_r.html)
- [Cassandra Data Modeling: Query-Driven Design](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-rdbms.html)
- [Cassandra Clustering Keys](https://docs.datastax.com/en/cassandra-oss/3.0/cassandra/dml/dmlClustering.html)
