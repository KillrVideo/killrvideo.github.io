# GET /api/v1/videos/id/{video_id}

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 404, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Video identifier |

## Response Schema (200)
```json
{
  "videoId": "uuid",
  "userId": "uuid",
  "name": "string",
  "description": "string|null",
  "location": "string(url)",
  "tags": "array<string>",
  "previewImageLocation": "string|null",
  "addedDate": "string(iso8601)",
  "views": "integer",
  "status": "PENDING|PROCESSING|READY|ERROR"
}
```

## Error Responses
- 404: Video not found
- 422: Validation error (invalid UUID format)

## Data Model
- Table: videos (partition_key: videoid)

## Key Patterns
- Direct partition key lookup, full-row read, UUID path parameter, status field in response
