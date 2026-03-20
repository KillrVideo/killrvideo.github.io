# GET /api/v1/videos/id/{video_id}/rating

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Video to get rating for |

## Response Schema (200)
```json
{
  "videoId": "uuid",
  "averageRating": "float(0.0-5.0, 2 decimal places)",
  "ratingCount": "integer(>= 0)"
}
```

## Error Responses
- 422: Validation error (invalid UUID format)

## Notes
- Returns 200 with ratingCount=0 and averageRating=0.0 when no ratings exist (not 404)

## Data Model
- Table: video_ratings (partition_key: videoid, clustering: userid)

## Key Patterns
- Intra-partition aggregation, partition-wide read, application-layer average computation, zero-rating edge case
