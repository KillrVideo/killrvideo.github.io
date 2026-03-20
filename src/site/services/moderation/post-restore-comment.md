---
title: "POST /api/v1/moderation/comments/{comment_id}/restore"
description: "Restore a previously removed comment by clearing its deleted flag"
endpoint: "/api/v1/moderation/comments/{comment_id}/restore"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-restore-comment.spec.md"
concepts:
  - soft-deletes-on-denormalized-tables
  - multi-table-restore
  - clustering-key-lookups
  - comment-data-modeling
order: 10
draft: true
---

# POST /api/v1/moderation/comments/{comment_id}/restore - Restore Comment

## Overview

This endpoint restores a comment that was previously soft-deleted through the moderation process. It clears the `is_deleted` flag on the comment, making it visible again to regular users.

**Why it exists**: Like video restoration, comment restoration acknowledges that moderation decisions are not always final. Comments removed in error, after a successful appeal, or during an overzealous moderation action can be reinstated without data loss.

The implementation is more complex than video restoration because comments in KillrVideo are stored in multiple denormalized tables with compound primary keys, requiring careful handling to locate and update the right rows.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/moderation/comments/{comment_id}/restore`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK
- **Body**: None required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `comment_id` | uuid | Comment to restore |

### Response Body (200)

```json
{
  "content_id": "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
  "content_type": "comment",
  "status_message": "Comment 77777777-8888-9999-aaaa-bbbbbbbbbbbb has been restored successfully."
}
```

## Cassandra Concepts Explained

### Soft Deletes on Denormalized Tables

Comments in KillrVideo are stored in at least two tables:

1. **`comments_by_video`** — all comments on a given video (primary query pattern)
2. **`comments_by_user`** — all comments made by a given user

Both tables contain the `is_deleted` flag. When a comment is soft-deleted or restored, **both tables must be updated**.

This is the fundamental challenge of denormalization in Cassandra: writes are cheap and reads are fast, but maintaining consistency across copies is the application's responsibility.

### Multi-Table Restore

The comment ID (`commentid`) is not the partition key in either comments table:

```cql
-- comments_by_video: partition key is videoid
PRIMARY KEY ((videoid), comment_timestamp, commentid)

-- comments_by_user: partition key is userid
PRIMARY KEY ((userid), comment_timestamp, commentid)
```

This means you cannot update `is_deleted` using `commentid` alone — you need the partition key (either `videoid` or `userid`) to locate the row efficiently.

**Approach 1: Store metadata at flag time**
When a comment is flagged or deleted, store `videoid` and `userid` in the flag record so restoration has the necessary context.

**Approach 2: Use a SAI index on commentid**
```cql
CREATE CUSTOM INDEX comments_by_video_commentid_idx
ON killrvideo.comments_by_video(commentid)
USING 'StorageAttachedIndex';
```

This allows looking up a comment by `commentid` even though it's not the partition key, at the cost of index maintenance overhead.

**Approach 3: Maintain a `comments` primary table**
A separate `comments` table with `commentid` as the partition key serves as the source of truth, with the denormalized tables as read-optimized copies.

### Clustering Key Considerations

In the `comments_by_video` table, the full primary key is `(videoid, comment_timestamp, commentid)`. To update a specific comment, you must provide all parts of the primary key:

```cql
-- Requires videoid and comment_timestamp to update a specific comment
UPDATE killrvideo.comments_by_video
SET is_deleted = false
WHERE videoid = ?
  AND comment_timestamp = ?
  AND commentid = ?;
```

Without the full primary key, Cassandra cannot uniquely identify the row to update. This is why restoring a comment requires more context than restoring a video (which has `videoid` as a simple partition key).

### Why Comment Restoration is Harder Than Video Restoration

| Aspect | Video | Comment |
|--------|-------|---------|
| Primary key | Simple (`videoid`) | Compound (`videoid` + timestamp + `commentid`) |
| Denormalized copies | 2–3 tables | 2 tables with different partition keys |
| Lookup by ID | Direct partition key | Requires SAI or stored context |
| Update complexity | Single column write | Must know full primary key |

## Data Model

### Table: `comments_by_video`

```cql
CREATE TABLE killrvideo.comments_by_video (
    videoid           uuid,
    comment_timestamp timestamp,
    commentid         timeuuid,
    userid            uuid,
    comment           text,
    is_deleted        boolean,
    PRIMARY KEY ((videoid), comment_timestamp, commentid)
) WITH CLUSTERING ORDER BY (comment_timestamp DESC, commentid DESC);

-- SAI index to look up by commentid without knowing videoid
CREATE CUSTOM INDEX comments_by_video_commentid_idx
ON killrvideo.comments_by_video(commentid)
USING 'StorageAttachedIndex';
```

### Table: `comments_by_user`

```cql
CREATE TABLE killrvideo.comments_by_user (
    userid            uuid,
    comment_timestamp timestamp,
    commentid         timeuuid,
    videoid           uuid,
    comment           text,
    is_deleted        boolean,
    PRIMARY KEY ((userid), comment_timestamp, commentid)
) WITH CLUSTERING ORDER BY (comment_timestamp DESC, commentid DESC);

-- SAI index to look up by commentid without knowing userid
CREATE CUSTOM INDEX comments_by_user_commentid_idx
ON killrvideo.comments_by_user(commentid)
USING 'StorageAttachedIndex';
```

## Database Queries

### 1. Find Comment by commentid (via SAI)

```python
async def find_comment_by_id(comment_id: str):
    comments_table = await get_table("comments_by_video")

    # SAI allows lookup by non-partition key
    comment = await comments_table.find_one(
        filter={"commentid": comment_id}
    )

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return comment
```

**Equivalent CQL**:
```cql
-- SAI index on commentid makes this efficient
SELECT * FROM killrvideo.comments_by_video
WHERE commentid = 77777777-8888-9999-aaaa-bbbbbbbbbbbb;
```

### 2. Restore in comments_by_video

```python
async def restore_comment_in_video_table(
    videoid: str,
    comment_timestamp: str,
    commentid: str
):
    table = await get_table("comments_by_video")
    await table.update_one(
        filter={
            "videoid": videoid,
            "comment_timestamp": comment_timestamp,
            "commentid": commentid
        },
        update={"$set": {"is_deleted": False}}
    )
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.comments_by_video
SET is_deleted = false
WHERE videoid = <videoid>
  AND comment_timestamp = <timestamp>
  AND commentid = 77777777-8888-9999-aaaa-bbbbbbbbbbbb;
```

### 3. Restore in comments_by_user

```python
async def restore_comment_in_user_table(
    userid: str,
    comment_timestamp: str,
    commentid: str
):
    table = await get_table("comments_by_user")
    await table.update_one(
        filter={
            "userid": userid,
            "comment_timestamp": comment_timestamp,
            "commentid": commentid
        },
        update={"$set": {"is_deleted": False}}
    )
```

### Full Restore Flow

```python
async def restore_comment(comment_id: str):
    # Step 1: Find comment to get context (videoid, userid, timestamp)
    comment = await find_comment_by_id(comment_id)

    # Step 2: Restore in both denormalized tables
    await restore_comment_in_video_table(
        comment["videoid"],
        comment["comment_timestamp"],
        comment_id
    )
    await restore_comment_in_user_table(
        comment["userid"],
        comment["comment_timestamp"],
        comment_id
    )

    return {
        "content_id": comment_id,
        "content_type": "comment",
        "status_message": f"Comment {comment_id} has been restored successfully."
    }
```

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. POST /api/v1/moderation/comments/{comment_id}/restore│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires moderator role                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate path parameter                              │
│    └─ comment_id must be valid UUID/timeuuid            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Find comment via SAI index on commentid              │
│    ├─ Retrieve: videoid, userid, comment_timestamp      │
│    └─ Return 404 if not found                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Update is_deleted = false in BOTH tables             │
│    ├─ comments_by_video (using videoid + timestamp)     │
│    └─ comments_by_user (using userid + timestamp)       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 with ContentRestoreResponse               │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. SAI Lookup for commentid

Comments tables are optimized for partition key queries (`WHERE videoid = ?`), not by `commentid`. The SAI index on `commentid` is specifically to support moderation operations like this one, which need to locate a comment by its ID without knowing the parent video.

### 2. Partial Failure Risk

The multi-table update is not atomic. If the `comments_by_video` update succeeds but `comments_by_user` fails, the comment is visible in video context but not in user profile context. This inconsistency is self-correcting if the restore endpoint is retried (both updates are idempotent).

### 3. timeuuid vs uuid

Comment IDs use `timeuuid` (time-based UUID, version 1), which embeds a timestamp. This is different from the `uuid` (version 4) used for user and video IDs. `timeuuid` provides natural chronological sorting when used as a clustering key.

### 4. Shared Response Schema with Video Restore

Both video and comment restore return `ContentRestoreResponse`:
```json
{ "content_id": "uuid", "content_type": "comment", "status_message": "..." }
```

The `content_type` field distinguishes which restore happened, allowing clients to use a single handler for both restore endpoints.

## Developer Tips

### Common Pitfalls

1. **Trying to update without full primary key**: Cassandra requires the complete primary key for an UPDATE. Don't try to update `WHERE commentid = ?` — it won't work without the partition key and clustering columns.

2. **Forgetting the user table**: Comments exist in two tables. Restoring only `comments_by_video` leaves the comment hidden in user profile views.

3. **Confusing timeuuid and uuid**: `commentid` is a `timeuuid`, not a `uuid`. Ensure your UUID validation and serialization handles both types.

4. **Not handling the SAI dependency**: If the SAI index on `commentid` doesn't exist, the lookup will fail or require ALLOW FILTERING (which causes a full table scan). Verify the index exists before deploying.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| SAI lookup by commentid | 10–20ms | Index scan (non-partition key) |
| Update comments_by_video | < 5ms | Full primary key write |
| Update comments_by_user | < 5ms | Full primary key write |
| Total | < 35ms | SAI lookup + two updates |

Comment restoration is slightly slower than video restoration because of the SAI lookup for the compound primary key context.

## Related Endpoints

- [POST /api/v1/moderation/videos/{video_id}/restore](/services/moderation/post-restore-video/) - Same pattern for videos (simpler)
- [POST /api/v1/moderation/flags/{flag_id}/action](/services/moderation/post-flag-action/) - Flag approval may trigger the original soft delete
