# GET /api/v1/videos/trending

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

## Query Parameters
| Name | Type | Required | Default | Constraints |
|------|------|----------|---------|-------------|
| intervalDays | integer | No | 7 | Must be 1, 7, or 30 |
| limit | integer | No | 5 | 1–10 |

## Response Schema (200)
```json
[
  {
    "videoId": "uuid",
    "userId": "uuid",
    "name": "string",
    "previewImageLocation": "string|null",
    "addedDate": "string(iso8601)",
    "views": "integer"
  }
]
```

## Error Responses
- 422: Validation error (invalid intervalDays value or limit out of range)

## Data Model
- Table: videos (partition_key: videoid, filters on added_date and status)
- Optional: trending_videos materialized table (window_days, rank)

## Key Patterns
- Time-windowed aggregation, counter-based ranking, application-layer sort, caching recommended
