# POST /api/v1/moderation/videos/{video_id}/restore

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `video_id`: uuid — video to restore

## Request Body
None required.

## Response Schema (200)
```json
{
  "content_id": "uuid",
  "content_type": "video",
  "status_message": "string"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 404: Video not found
- 422: Invalid UUID format for video_id

## Data Model
- Table: videos (partition_key: videoid) — primary update
- Table: user_videos (partition_key: userid) — denormalized copy, also updated
- Update: is_deleted = false (soft delete cleared)

## Key Patterns
- Soft delete pattern: is_deleted boolean flag, not a hard DELETE
- Idempotent: restoring an already-active video returns 200, no error
- Read-then-write: fetch video to verify existence
- Multi-table update: all denormalized copies must have is_deleted = false
- ContentRestoreResponse shared with comment restore endpoint
