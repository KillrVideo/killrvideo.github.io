# POST /api/v1/videos/{video_id}/ratings

## Metadata
- Service: Comments & Ratings
- Auth: viewer role (JWT bearer)
- Status Codes: 200, 401, 403, 422

## Path Parameters
- `video_id`: uuid — video to rate

## Request Schema
```json
{ "rating": "integer(min:1, max:5)" }
```

## Response Schema (200)
```json
{
  "rating": "integer",
  "videoid": "uuid",
  "userid": "uuid",
  "created_at": "timestamp (ISO-8601)",
  "updated_at": "timestamp (ISO-8601)"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Token does not have viewer role
- 422: Validation error (rating out of range, missing field)

## Data Model
- Table: video_ratings_by_user (partition_key: videoid, clustering_key: userid)
- Table: video_rating_counters (partition_key: videoid, counter columns: rating_counter, rating_total)

## Key Patterns
- Upsert semantics — INSERT creates or updates existing row for (videoid, userid)
- Read old rating before write to compute counter delta for updates
- Counter table updated atomically per video for fast aggregate reads
- Returns 200 (not 201) because create/update cannot be distinguished at call time
- Two writes are not atomic — counters may briefly be inconsistent
