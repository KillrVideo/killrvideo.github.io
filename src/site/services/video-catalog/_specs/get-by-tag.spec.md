# GET /api/v1/videos/by-tag/{tag_name}

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tag_name | string | Yes | Tag to filter by |

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
- 422: Validation error (invalid page/pageSize)

## Data Model
- Table: videos (partition_key: videoid, SAI index on tags set<text> and status)

## Key Patterns
- SAI index on collection type (set<text>), CONTAINS predicate, combined SAI filtering, tag normalization
