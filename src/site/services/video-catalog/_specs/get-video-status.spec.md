# GET /api/v1/videos/id/{video_id}/status

## Metadata
- Service: Video Catalog
- Auth: Required (creator or moderator role)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Video to check |

## Response Schema (200)
```json
{
  "videoId": "uuid",
  "status": "PENDING|PROCESSING|READY|ERROR"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role
- 404: Video not found
- 422: Validation error (invalid UUID format)

## Data Model
- Table: videos (partition_key: videoid, projected columns: status)

## Key Patterns
- Lightweight column projection, status enum, polling pattern support, terminal state detection
