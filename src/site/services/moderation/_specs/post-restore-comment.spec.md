# POST /api/v1/moderation/comments/{comment_id}/restore

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `comment_id`: timeuuid — comment to restore

## Request Body
None required.

## Response Schema (200)
```json
{
  "content_id": "uuid",
  "content_type": "comment",
  "status_message": "string"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 404: Comment not found
- 422: Invalid UUID format for comment_id

## Data Model
- Table: comments_by_video (partition: videoid, clustering: comment_timestamp, commentid)
- Table: comments_by_user (partition: userid, clustering: comment_timestamp, commentid)
- SAI index: comments_by_video_commentid_idx on commentid (required for lookup)
- SAI index: comments_by_user_commentid_idx on commentid (required for lookup)
- Update: is_deleted = false in BOTH tables

## Key Patterns
- SAI index on commentid required to look up compound primary key context
- Multi-table restore: both comments_by_video and comments_by_user updated
- Full primary key needed for updates (partition key + all clustering keys)
- timeuuid (not uuid v4) for commentid — time-based for chronological sorting
- Idempotent: restoring an active comment returns 200, no error
- Partial failure risk: if second table update fails, retry is safe (idempotent)
- ContentRestoreResponse shared schema with video restore
