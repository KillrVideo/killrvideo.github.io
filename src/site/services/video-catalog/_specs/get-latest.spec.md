# GET /api/v1/videos/latest

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

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
      "previewImageLocation": "string(url)",
      "addedDate": "string(iso8601)"
    }
  ],
  "total": "integer",
  "page": "integer",
  "pageSize": "integer"
}
```

## Error Responses
- 422: Validation error (invalid page or pageSize values)

## Data Model
- Table: latest_videos (partition_key: added_date_bucket, clustering: added_date DESC, videoid)

## Key Patterns
- Day bucketing for time-series, multi-bucket pagination, clustering column ordering, denormalized summary table
