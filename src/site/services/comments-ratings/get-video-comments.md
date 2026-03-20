---
title: "GET /api/v1/videos/{video_id}/comments"
description: "Retrieve paginated comments for a video"
endpoint: "/api/v1/videos/{video_id}/comments"
method: "GET"
spec_artifact: "/services/comments-ratings/_specs/get-video-comments.spec.md"
concepts:
  - partition-key-queries
  - timeuuid-ordering
  - pagination
  - query-driven-design
order: 3
draft: true
---

# GET /api/v1/videos/{video_id}/comments - Video Comments Feed

## Overview

This endpoint returns a paginated list of comments for a specific video, ordered with the newest comments first. Because the `comments_by_video` table is partitioned by `videoid`, fetching all comments for a video is a single, efficient partition read — no scatter-gather across nodes required.

**Why it exists**: Videos need a public comment feed. The table design here is a direct consequence of this query requirement: instead of trying to filter a general-purpose comments table, we have a table that is literally shaped for this exact read.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/{video_id}/comments`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video whose comments to retrieve |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `pageSize` | integer | 10 | Number of comments per page |

### Response Body

```json
{
  "items": [
    {
      "commentid": "a3b4c5d6-0000-11ee-be56-0242ac120002",
      "videoid": "550e8400-e29b-41d4-a716-446655440000",
      "userid": "7f3e1a2b-dead-beef-cafe-123456789abc",
      "comment": "This tutorial finally made clustering keys click for me!",
      "sentiment_score": 0.87,
      "firstName": "Jane",
      "lastName": "Developer"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

## Cassandra Concepts Explained

### Query-Driven Table Design

In a relational database, you might have a single `comments` table and use a `WHERE video_id = ?` clause with a secondary index or foreign key. Cassandra works differently:

**Relational approach** (don't do this in Cassandra):
```cql
-- Requires a full table scan or inefficient secondary index
SELECT * FROM comments WHERE video_id = ? ORDER BY created_at DESC;
```

**Cassandra approach** (what we use):
```cql
-- Direct partition key lookup — extremely fast
SELECT * FROM comments_by_video WHERE videoid = ?;
```

The `comments_by_video` table exists *specifically* because "fetch comments for a video" is a known, frequent query. The table is designed around the query, not the other way around.

### Partition Key Lookups

When you query by partition key in Cassandra, the coordinator node computes a hash of the partition key value and routes the request directly to the node(s) responsible for that hash range. This means:

- **No full table scan** — only one (or a few replicated) nodes are contacted
- **Linear scalability** — adding nodes distributes partitions; this query gets faster as the cluster grows
- **Predictable latency** — O(1) regardless of total table size

A partition key query is the single most important performance optimization in Cassandra data modeling.

### TimeUUID-Based Ordering

Comments in the `comments_by_video` table are clustered by `commentid` with `DESC` order. Because `commentid` is a TimeUUID (UUID v1), the cluster order is chronological — newer comments have higher timestamp bits and therefore sort to the top.

This means:
- The first rows in the partition are always the most recent comments
- No `ORDER BY` clause is needed; the storage engine already keeps them sorted
- Pagination can be done efficiently by skipping rows, not by sorting a result set

### Pagination in Cassandra

Traditional SQL pagination uses `OFFSET`:
```sql
SELECT * FROM comments LIMIT 10 OFFSET 20; -- SQL
```

Cassandra supports a simpler `LIMIT` but offset-based pagination is expensive (it reads and discards rows). The more efficient approach uses **cursor/token pagination** with the last seen clustering key. The current implementation uses page-number pagination for simplicity, which is appropriate for comment feeds where users rarely page deep.

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

**Why this table answers this query perfectly**:
- `WHERE videoid = ?` hits the partition key directly
- Rows already come back in newest-first order (no sort needed)
- `LIMIT ?` efficiently caps the result set

## Database Queries

### 1. Fetch Comments for a Video

```python
async def get_comments_by_video(video_id: UUID, page: int, page_size: int):
    table = await get_table("comments_by_video")
    skip = (page - 1) * page_size
    results = await table.find(
        filter={"videoid": str(video_id)},
        limit=page_size,
        skip=skip
    )
    return results
```

**Equivalent CQL**:
```cql
SELECT videoid, commentid, userid, comment, sentiment_score
FROM killrvideo.comments_by_video
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000
LIMIT 10;
```

**Performance**: O(1) for partition lookup + O(pageSize) to read rows. Extremely fast for any page size up to a few hundred rows.

### 2. Get Total Comment Count

```python
async def count_comments_for_video(video_id: UUID) -> int:
    table = await get_table("comments_by_video")
    count = await table.count_documents(
        filter={"videoid": str(video_id)}
    )
    return count
```

**Equivalent CQL**:
```cql
SELECT COUNT(*) FROM killrvideo.comments_by_video
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Note**: `COUNT(*)` on a partition is efficient but still reads all matching rows internally. For very large partitions, consider maintaining a separate counter.

### 3. Enrich with User Names

After fetching comments, the service joins user names from the `users` table using the `userid` from each comment row. This is an application-level join — Cassandra does not support JOINs natively.

```python
for comment in comments:
    user = await users_table.find_one(
        filter={"userid": comment["userid"]}
    )
    comment["firstName"] = user["firstname"]
    comment["lastName"] = user["lastname"]
```

**Performance consideration**: This results in N+1 queries. For better performance, batch the user lookups or cache user display names.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/{video_id}/comments  │
│    ?page=1&pageSize=10                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validate path parameter (video_id is valid UUID)      │
│    Validate query params (page ≥ 1, pageSize 1–100)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Query comments_by_video                               │
│    WHERE videoid = ? LIMIT pageSize SKIP offset          │
│    └─ Results already in newest-first order              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Count total comments for video                        │
│    (Used to calculate total pages in response)           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Enrich each comment with user firstName, lastName     │
│    (application-level join against users table)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with PaginatedResponse                  │
│    { items, total, page, pageSize }                      │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Deep Pagination is Expensive

Requesting page 100 with pageSize 10 causes the database to internally read and discard 990 rows before returning the 10 you want. For user-facing comment feeds, this is acceptable because users virtually never page that deep. For administrative bulk reads, use cursor-based pagination instead.

### 2. Application-Level Join for User Names

The `comments_by_video` table stores `userid` but not the user's display name. To show `firstName` and `lastName` in the response, the service makes additional lookups against the `users` table. This is the standard approach in Cassandra — normalize when writing (store only the foreign key), denormalize when reading (look up related data in the application layer).

An alternative design would denormalize the user name into the comments table at write time. That trades read performance (fewer lookups) for write complexity (must update all comment rows if a user changes their name).

### 3. Eventual Consistency

In a distributed Cassandra cluster, a comment written with consistency level ONE might not immediately be visible on a replica that serves this read. For most comment feeds, this brief delay (milliseconds to seconds) is acceptable. If strong read-after-write consistency is required, use `CONSISTENCY QUORUM` on both the write and the read.

### 4. Empty Partitions

If a video has no comments, the partition simply does not exist. The query returns zero rows with no error. The response will be `{ "items": [], "total": 0, ... }`.

## Developer Tips

### Common Pitfalls

1. **Filtering by non-partition columns**: Do not attempt `WHERE userid = ?` on `comments_by_video`. That column is not the partition key, and the query will require `ALLOW FILTERING` (full partition scan) or fail entirely. Use `comments_by_user` for that query pattern.

2. **Assuming sorted results without clustering order**: The `DESC` clustering order is defined in the table schema. If you re-create the table without it, results come back in ascending (oldest-first) order.

3. **Ignoring the N+1 problem**: Fetching user names one at a time inside a loop is fine for small page sizes but degrades noticeably at pageSize=50+. Batch the lookups.

4. **Not validating `video_id` format**: An invalid UUID string will cause a database error. Validate with Pydantic or equivalent before querying.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch page of comments | **< 10ms** | Partition key lookup + sequential row read |
| Count comments in partition | **< 20ms** | Single partition scan |
| User name enrichment (per comment) | **< 5ms** | Partition key lookup on users table |
| Total (page of 10 comments) | **< 60ms** | Dominated by serial user lookups |

### Testing Tips

```python
async def test_get_video_comments_pagination():
    # Post several comments first
    for i in range(15):
        await client.post(
            f"/api/v1/videos/{video_id}/comments",
            json={"text": f"Comment number {i}"},
            headers={"Authorization": f"Bearer {token}"}
        )

    # Fetch first page
    response = await client.get(
        f"/api/v1/videos/{video_id}/comments?page=1&pageSize=10"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 10
    assert data["total"] == 15

    # Verify newest-first ordering
    timestamps = [c["commentid"] for c in data["items"]]
    assert timestamps == sorted(timestamps, reverse=True)
```

## Related Endpoints

- [POST /api/v1/videos/{video_id}/comments](/services/comments-ratings/post-comment/) - Add a comment
- [GET /api/v1/users/{user_id}/comments](/services/comments-ratings/get-user-comments/) - Same data, different partition key
- [GET /api/v1/videos/{video_id}/ratings](/services/comments-ratings/get-ratings/) - Video rating aggregate

## Further Learning

- [Cassandra Query-Driven Design](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-rdbms.html)
- [Cassandra Pagination](https://docs.datastax.com/en/developer/python-driver/latest/query_options/)
- [TimeUUID Functions](https://docs.datastax.com/en/cql-oss/3.3/cql/cql_reference/timeuuid_functions_r.html)
