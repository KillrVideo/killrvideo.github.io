# POST /api/v1/videos/id/{video_id}/rating

## Metadata
- Service: Video Catalog
- Auth: Required (viewer role)
- Status Codes: 204, 401, 403, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Video to rate |

## Request Schema
```json
{ "rating": "integer(1-5, required)" }
```

## Response (204)
No response body.

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (not a viewer)
- 422: Validation error (rating not in [1..5] or invalid UUID)

## Data Model
- Table: video_ratings (partition_key: videoid, clustering: userid)

## Key Patterns
- Upsert by composite primary key, idempotent write, 204 No Content, no pre-read required
