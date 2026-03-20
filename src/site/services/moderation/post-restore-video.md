---
title: "POST /api/v1/moderation/videos/{video_id}/restore"
description: "Restore a previously removed video by clearing its deleted flag"
endpoint: "/api/v1/moderation/videos/{video_id}/restore"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-restore-video.spec.md"
concepts:
  - soft-deletes
  - content-restoration
  - is-deleted-flag-pattern
  - denormalized-tables
order: 9
draft: true
---

# POST /api/v1/moderation/videos/{video_id}/restore - Restore Video

## Overview

This endpoint restores a video that was previously removed (soft-deleted) through the moderation process. It does not undelete records from the database — instead it clears the `is_deleted` flag, making the video visible again to regular users.

**Why it exists**: Content moderation is not always final. Moderators make mistakes, appeals are granted, or a video removed as part of a flag investigation turns out to be legitimate. Rather than permanently deleting content, KillrVideo uses soft deletes so that removed content can be restored without data loss.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/moderation/videos/{video_id}/restore`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK
- **Body**: None required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | uuid | Video to restore |

### Response Body (200)

```json
{
  "content_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "video",
  "status_message": "Video 550e8400-e29b-41d4-a716-446655440000 has been restored successfully."
}
```

## Cassandra Concepts Explained

### Soft Deletes and the `is_deleted` Flag Pattern

A **hard delete** in Cassandra uses the `DELETE` statement, which writes a tombstone marker. Tombstones have performance implications and can cause read amplification if many deleted records accumulate.

A **soft delete** instead updates a boolean column:

```cql
-- Soft delete: hide content from users without removing the row
UPDATE killrvideo.videos
SET is_deleted = true
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;

-- Restoration: make content visible again
UPDATE killrvideo.videos
SET is_deleted = false
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Benefits of soft deletes**:
- **Reversible**: Restoration is a simple flag update
- **No tombstones**: Avoids Cassandra tombstone accumulation
- **Audit trail**: The row still exists with its full history
- **Data recovery**: Easy to recover from moderator errors
- **Analytics**: Deleted content can still be analyzed in reports

**The trade-off**:
- **Application filtering**: Every query must filter `WHERE is_deleted = false` (or equivalent)
- **Storage cost**: Soft-deleted rows still occupy disk space
- **Index pollution**: SAI indexes include soft-deleted rows; queries must filter them out

### Content Visibility Filtering

With soft deletes, all content-serving queries must include the `is_deleted` filter:

```cql
-- Public video browse (only active videos)
SELECT * FROM killrvideo.videos
WHERE is_deleted = false
LIMIT 20;

-- Moderator view (can see deleted videos for review)
SELECT * FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
-- No is_deleted filter for moderators
```

The SAI index on `is_deleted` makes this filter efficient.

### Denormalized Tables and Restoration

The KillrVideo video catalog is denormalized — the same video data is stored in multiple tables optimized for different query patterns:

- `videos` — primary table, partition key: `videoid`
- `user_videos` — videos by user, partition key: `userid`, clustering: `added_date`
- `latest_videos` — recent videos feed, partition key: `yyyymmdd`, clustering: `added_date`

When a video is soft-deleted, all copies across these tables should have `is_deleted = true`. Restoration must therefore update all relevant tables:

```python
async def restore_video(video_id: str):
    # Update all denormalized copies
    await videos_table.update_one(
        filter={"videoid": video_id},
        update={"$set": {"is_deleted": False}}
    )
    await user_videos_table.update_one(
        filter={"videoid": video_id},
        update={"$set": {"is_deleted": False}}
    )
    # ... additional tables as needed
```

This is the complexity introduced by denormalization: writes touch multiple tables. Restoration must be thorough to avoid inconsistency (e.g., video restored in `videos` but still hidden in `user_videos`).

## Data Model

### Table: `videos`

```cql
CREATE TABLE killrvideo.videos (
    videoid     uuid PRIMARY KEY,
    userid      uuid,
    name        text,
    description text,
    location    text,
    location_type int,
    tags        set<text>,
    added_date  timestamp,
    is_deleted  boolean           -- Soft delete flag
);

-- SAI index for visibility filtering
CREATE CUSTOM INDEX videos_is_deleted_idx
ON killrvideo.videos(is_deleted)
USING 'StorageAttachedIndex';
```

### Table: `user_videos` (denormalized copy)

```cql
CREATE TABLE killrvideo.user_videos (
    userid      uuid,
    added_date  timestamp,
    videoid     uuid,
    name        text,
    is_deleted  boolean,          -- Must also be updated on restore
    PRIMARY KEY ((userid), added_date, videoid)
) WITH CLUSTERING ORDER BY (added_date DESC, videoid ASC);
```

## Database Queries

### Restore Video (Primary Table)

```python
async def restore_video_in_table(video_id: str):
    videos_table = await get_table("videos")

    # Verify video exists
    video = await videos_table.find_one(filter={"videoid": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    await videos_table.update_one(
        filter={"videoid": video_id},
        update={"$set": {"is_deleted": False}}
    )

    return {
        "content_id": video_id,
        "content_type": "video",
        "status_message": f"Video {video_id} has been restored successfully."
    }
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.videos
SET is_deleted = false
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: O(1) — partition key write

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. POST /api/v1/moderation/videos/{video_id}/restore    │
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
│    └─ video_id must be valid UUID                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Fetch video to verify exists                         │
│    └─ Return 404 if not found                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. UPDATE videos SET is_deleted = false                 │
│    └─ Also update denormalized tables (user_videos etc) │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 with ContentRestoreResponse               │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Restoring an Already-Active Video

If `is_deleted` is already `false` (video was never deleted, or already restored), the update is a no-op. The response still returns 200 — restoration is idempotent. The `status_message` can optionally note "Video was already active" for clarity.

### 2. Multi-Table Consistency

For complete restoration, all denormalized copies must be updated. If any update fails (network error, Cassandra node unavailable), the video may be visible in some query patterns but not others. This is an eventual consistency challenge inherent to denormalized Cassandra schemas.

For production systems, consider:
- Retry logic with idempotency (re-running the restore on failure is safe)
- A background reconciliation job that finds videos with inconsistent `is_deleted` state across tables
- Batch operations to group related updates

### 3. What "Restoration" Covers

This endpoint only clears the `is_deleted` flag — it does not:
- Reopen or close any associated flags
- Restore the video's search index ranking
- Notify the video owner that their content was restored

These downstream actions would be separate operations or background jobs.

### 4. Response Shape Matches Comment Restore

The `ContentRestoreResponse` schema is shared between video and comment restoration:

```json
{
  "content_id": "uuid",
  "content_type": "video" | "comment",
  "status_message": "string"
}
```

Client code can handle both restore endpoints with the same response handler.

## Developer Tips

### Common Pitfalls

1. **Forgetting denormalized tables**: Restoring only the primary `videos` table leaves the video hidden in browse-by-user queries. Identify all tables that store `is_deleted` for videos and update them all.

2. **Not checking if video exists**: Updating a non-existent partition in Cassandra creates an empty row. Always verify existence before updating.

3. **Inconsistent soft-delete filtering**: If some queries filter `WHERE is_deleted = false` and others don't, restored content may not appear consistently. Audit all video-serving queries for consistent soft-delete handling.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Verify video exists | < 5ms | Partition key lookup |
| Update videos table | < 5ms | Partition key write |
| Update user_videos | < 5ms | Partition key write |
| Total | < 20ms | Multiple partition key operations |

## Related Endpoints

- [POST /api/v1/moderation/comments/{comment_id}/restore](/services/moderation/post-restore-comment/) - Same pattern for comments
- [POST /api/v1/moderation/flags/{flag_id}/action](/services/moderation/post-flag-action/) - Approve/reject flags (which may trigger soft delete)
