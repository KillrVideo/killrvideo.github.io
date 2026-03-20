---
title: "GET /api/v1/users/{user_id}/comments"
description: "Retrieve paginated comments made by a specific user"
endpoint: "/api/v1/users/{user_id}/comments"
method: "GET"
spec_artifact: "/services/comments-ratings/_specs/get-user-comments.spec.md"
concepts:
  - denormalization
  - query-driven-design
  - partition-key-queries
  - timeuuid-ordering
order: 4
draft: true
---

# GET /api/v1/users/{user_id}/comments - User Comment History

## Overview

This endpoint returns all comments made by a specific user, paginated and sorted newest-first. It reads from the `comments_by_user` table, which contains the same comment data as `comments_by_video` but reorganized with `userid` as the partition key.

**Why it exists**: This query cannot be efficiently answered by `comments_by_video` (which is partitioned by `videoid`). Rather than scanning every video's partition looking for comments from a specific user, we maintain a separate table where `userid` is the partition key. This is the essence of Cassandra's query-driven design philosophy.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/users/{user_id}/comments`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | The user whose comment history to retrieve |

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
  "total": 7,
  "page": 1,
  "pageSize": 10
}
```

## Cassandra Concepts Explained

### Denormalization as a Feature, Not a Flaw

In relational databases, storing the same data in two places is usually a bug — it creates update anomalies and wastes space. In Cassandra, it is a deliberate and encouraged design technique.

The reason comes down to Cassandra's fundamental constraint: **efficient queries must filter by partition key**. Given two different queries:

1. "Show comments on video X" — needs partition key = `videoid`
2. "Show comments by user Y" — needs partition key = `userid`

These two queries cannot both be served efficiently from a single table. The solution is to write duplicate data at insert time and maintain two tables:

| Table | Partition Key | Answers |
|-------|--------------|---------|
| `comments_by_video` | `videoid` | "What comments are on this video?" |
| `comments_by_user` | `userid` | "What has this user commented?" |

The storage cost is 2x, but both queries run at O(1). In a system that reads far more often than it writes (a typical content platform), this trade-off is almost always worth it.

### The Same Data, Different Shape

From the application's perspective, `comments_by_user` and `comments_by_video` are mirrors. Every comment write creates a row in both tables. Every comment delete (if implemented) must remove rows from both tables. The rows differ only in which column is the partition key.

This is sometimes called **table-per-query** or the **query-first design pattern**.

### Why Not Use a Secondary Index?

A natural question: why not put a secondary index on the `userid` column of `comments_by_video` instead of maintaining a whole second table?

Cassandra secondary indexes (and even SAI indexes) on high-cardinality columns like `userid` are problematic at scale:
- A user ID is unique per user — every row has a distinct value
- Querying by a high-cardinality secondary index sends requests to many or all nodes (a "scatter-gather" operation)
- This becomes progressively slower as the cluster grows

A denormalized table avoids all of this: `comments_by_user` with `userid` as the partition key routes the query to exactly the right node(s) every time.

## Data Model

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

**Comparison with `comments_by_video`**:

| Aspect | comments_by_video | comments_by_user |
|--------|------------------|-----------------|
| Partition key | `videoid` | `userid` |
| Clustering key | `commentid DESC` | `commentid DESC` |
| Optimal query | By video | By user |
| Data stored | Same set of columns | Same set of columns |

The only structural difference is the partition key. Everything else — the clustering order, the stored columns — is identical.

## Database Queries

### 1. Fetch Comments by User

```python
async def get_comments_by_user(user_id: UUID, page: int, page_size: int):
    table = await get_table("comments_by_user")
    skip = (page - 1) * page_size
    results = await table.find(
        filter={"userid": str(user_id)},
        limit=page_size,
        skip=skip
    )
    return results
```

**Equivalent CQL**:
```cql
SELECT userid, commentid, videoid, comment, sentiment_score
FROM killrvideo.comments_by_user
WHERE userid = 7f3e1a2b-dead-beef-cafe-123456789abc
LIMIT 10;
```

**Performance**: O(1) — direct partition key lookup, single node.

### 2. Get Total Comment Count for User

```python
async def count_comments_by_user(user_id: UUID) -> int:
    table = await get_table("comments_by_user")
    return await table.count_documents(
        filter={"userid": str(user_id)}
    )
```

**Equivalent CQL**:
```cql
SELECT COUNT(*) FROM killrvideo.comments_by_user
WHERE userid = 7f3e1a2b-dead-beef-cafe-123456789abc;
```

### 3. Enrich with User Names

The response includes `firstName` and `lastName`. Since `user_id` is already known from the path parameter, a single user lookup suffices for this endpoint (unlike `get-video-comments`, which needs one lookup per distinct commenter).

```python
user = await users_table.find_one(filter={"userid": str(user_id)})
for comment in comments:
    comment["firstName"] = user["firstname"]
    comment["lastName"] = user["lastname"]
```

**Performance advantage over `get-video-comments`**: Only one user lookup regardless of page size, because all comments belong to the same user.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/users/{user_id}/comments    │
│    ?page=1&pageSize=10                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validate user_id (valid UUID format)                  │
│    Validate pagination params                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Query comments_by_user                                │
│    WHERE userid = ? LIMIT pageSize SKIP offset           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Count total comments for user                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Fetch user profile (single lookup for firstName/      │
│    lastName — same user for all rows)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with PaginatedResponse                  │
│    { items, total, page, pageSize }                      │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Consistency with `get-video-comments`

The comment data in `comments_by_user` is written simultaneously with `comments_by_video` by the [POST /api/v1/videos/{video_id}/comments](/services/comments-ratings/post-comment/) endpoint. Because the writes are independent (no transaction), there is a small window where a comment appears in one table but not the other. In practice this inconsistency resolves in milliseconds.

### 2. Efficient User Name Enrichment

Unlike the video comments endpoint, which may need to look up N different users for N comments on a page, this endpoint always queries the same user. One lookup for the user's display name enriches every row on the page. This is a subtle but real performance advantage of this query pattern.

### 3. User Existence Not Validated

This endpoint does not check whether `user_id` refers to an existing user. If the user does not exist (or has never commented), the response is simply `{ "items": [], "total": 0, ... }`. No 404 is returned.

### 4. Public Access to Comment History

Comment history is public. Any caller can view any user's comment history without authentication. If your deployment requires privacy controls on comment history, add an auth check and compare `user_id` against the token subject.

## Developer Tips

### Common Pitfalls

1. **Querying `comments_by_video` for user comments**: This requires filtering on a non-partition column and will either fail or perform a full partition scan with `ALLOW FILTERING`. Always use `comments_by_user` for this query.

2. **Forgetting this table when deleting comments**: If a comment deletion feature is added, it must remove rows from *both* `comments_by_video` and `comments_by_user`. Removing from only one table leaves orphaned data.

3. **Treating the two tables as independent**: They are mirrors. Any inconsistency between them is a data integrity issue, even if Cassandra itself cannot enforce consistency across tables.

4. **N+1 user lookups**: Unlike the video comments endpoint, this endpoint can enrich all comments with a single user lookup. Don't make multiple identical lookups in a loop.

### Design Insight: The Cost of Each Pattern

| Design | Write cost | Read cost (by video) | Read cost (by user) |
|--------|-----------|---------------------|---------------------|
| Single table, by video | 1 insert | Partition key (fast) | ALLOW FILTERING (slow) |
| Single table, by user | 1 insert | ALLOW FILTERING (slow) | Partition key (fast) |
| Two tables (current) | 2 inserts | Partition key (fast) | Partition key (fast) |

The two-table design pays a small write overhead to make both reads efficient.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch page of user comments | **< 10ms** | Partition key lookup |
| Count user's comments | **< 20ms** | Single partition scan |
| User name lookup | **< 5ms** | One partition key lookup |
| Total (page of 10 comments) | **< 35ms** | Dominated by count query |

### Testing Tips

```python
async def test_user_comment_history():
    # Post comments on different videos
    video_ids = [uuid4() for _ in range(3)]
    for vid in video_ids:
        await client.post(
            f"/api/v1/videos/{vid}/comments",
            json={"text": f"Commenting on {vid}"},
            headers={"Authorization": f"Bearer {token}"}
        )

    response = await client.get(f"/api/v1/users/{user_id}/comments")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3

    # Each comment should reference a different video
    video_ids_in_response = {c["videoid"] for c in data["items"]}
    assert len(video_ids_in_response) == 3
```

## Related Endpoints

- [POST /api/v1/videos/{video_id}/comments](/services/comments-ratings/post-comment/) - Write to both tables
- [GET /api/v1/videos/{video_id}/comments](/services/comments-ratings/get-video-comments/) - Same data, partitioned by video
- [GET /api/v1/users/{user_id}](/services/account-management/get-user-by-id/) - User profile information

## Further Learning

- [Cassandra Data Modeling Anti-Patterns](https://www.datastax.com/blog/cassandra-data-modeling-anti-patterns)
- [Denormalization in Cassandra](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-rdbms.html)
- [Query-First Design](https://www.datastax.com/learn/data-modeling-by-example)
