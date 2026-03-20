# POST /api/v1/videos/{video_id}/comments

## Metadata
- Service: Comments & Ratings
- Auth: viewer role (JWT bearer)
- Status Codes: 201, 400, 401, 403, 422

## Path Parameters
- `video_id`: uuid — target video

## Request Schema
```json
{ "text": "string(min:1, max:1000)" }
```

## Response Schema (201)
```json
{
  "commentid": "timeuuid",
  "videoid": "uuid",
  "userid": "uuid",
  "comment": "string",
  "sentiment_score": "float | null",
  "firstName": "string",
  "lastName": "string"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Token present but does not have viewer role
- 422: Validation error (text missing, text exceeds 1000 chars)

## Data Model
- Table: comments_by_video (partition_key: videoid, clustering_key: commentid DESC)
- Table: comments_by_user (partition_key: userid, clustering_key: commentid DESC)

## Key Patterns
- Dual-table write to comments_by_video and comments_by_user
- TimeUUID (uuid1) for commentid — encodes timestamp for chronological clustering
- Optional sentiment scoring before persistence
- No cross-table transaction — eventual consistency between tables
