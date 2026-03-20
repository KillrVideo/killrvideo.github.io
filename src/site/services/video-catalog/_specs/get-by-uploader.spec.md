# GET /api/v1/videos/by-uploader/{uploader_id}

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| uploader_id | uuid | Yes | User whose videos to return |

## Query Parameters
| Name | Type | Required | Default | Constraints |
|------|------|----------|---------|-------------|
| page | integer | No | 1 | >= 1 |
| pageSize | integer | No | 9 | 1–20 |

## Response Schema (200)
```json
{
  "items": [
    {
      "videoId": "uuid",
      "userId": "uuid",
      "name": "string",
      "previewImageLocation": "string|null",
      "addedDate": "string(iso8601)"
    }
  ],
  "total": "integer",
  "page": "integer",
  "pageSize": "integer"
}
```

## Error Responses
- 422: Validation error (invalid UUID format)

## Data Model
- Table: videos (partition_key: videoid, SAI index on userid and status)

## Key Patterns
- SAI on non-primary-key column, secondary access pattern, status=READY filter, application-layer sort
