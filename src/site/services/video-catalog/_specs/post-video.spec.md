# POST /api/v1/videos

## Metadata
- Service: Video Catalog
- Auth: Required (creator role)
- Status Codes: 202, 401, 403, 422

## Request Schema
```json
{ "youtubeUrl": "string(uri, required)", "title": "string(optional)" }
```

## Response Schema (202)
```json
{
  "videoId": "uuid",
  "userId": "uuid",
  "name": "string|null",
  "description": "string|null",
  "location": "string(url)",
  "tags": "array<string>",
  "previewImageLocation": "string|null",
  "addedDate": "string(iso8601)",
  "status": "PENDING"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Authenticated but lacks creator role
- 422: Validation error (invalid youtubeUrl format)

## Data Model
- Table: videos (partition_key: videoid)
- Table: latest_videos (written by background worker when status = READY)

## Key Patterns
- 202 Accepted pattern, background processing, PENDING→PROCESSING→READY state machine, YouTube API enrichment, set<text> for tags
