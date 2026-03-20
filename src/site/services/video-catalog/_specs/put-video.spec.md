# PUT /api/v1/videos/id/{video_id}

## Metadata
- Service: Video Catalog
- Auth: Required (owner or moderator role)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Video to update |

## Request Schema
```json
{
  "title": "string(optional)",
  "description": "string(optional)",
  "tags": "array<string>(optional)"
}
```

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
  "status": "string"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Authenticated user is not the owner and not a moderator
- 404: Video not found
- 422: Validation error

## Data Model
- Table: videos (partition_key: videoid)

## Key Patterns
- Partial update with $set, set<text> full replacement, owner-or-moderator authorization, read-modify-write pattern
