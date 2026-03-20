# GET /api/v1/videos/{video_id}/ratings

## Metadata
- Service: Comments & Ratings
- Auth: Optional (viewer role enriches response)
- Status Codes: 200, 422

## Path Parameters
- `video_id`: uuid — video to retrieve rating data for

## Response Schema (200, unauthenticated)
```json
{
  "videoId": "uuid",
  "averageRating": "float | null",
  "totalRatingsCount": "integer"
}
```

## Response Schema (200, authenticated viewer)
```json
{
  "videoId": "uuid",
  "averageRating": "float | null",
  "totalRatingsCount": "integer",
  "currentUserRating": "integer | null"
}
```

## Error Responses
- 422: Validation error (invalid UUID format)

## Data Model
- Table: video_rating_counters (partition_key: videoid, counter columns: rating_counter, rating_total)
- Table: video_ratings_by_user (partition_key: videoid, clustering_key: userid) — queried only when authenticated

## Key Patterns
- Counter table read for O(1) aggregate — avoids scanning all individual ratings
- Average computed in application: rating_total / rating_counter
- Optional auth: invalid/missing token silently falls back to unauthenticated shape (no 401)
- currentUserRating field is absent (not null) in unauthenticated responses
- Returns 200 with averageRating: null and totalRatingsCount: 0 when video has no ratings (no 404)
