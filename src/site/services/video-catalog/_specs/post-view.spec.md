# POST /api/v1/videos/id/{video_id}/view

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 204, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Target video identifier |

## Request Body
None

## Response (204)
No response body.

## Error Responses
- 422: Validation error (invalid UUID format for video_id)

## Data Model
- Table: videos (partition_key: videoid, counter column: views)

## Key Patterns
- Counter column increment via $inc, fire-and-forget write, eventual consistency, 204 No Content pattern
