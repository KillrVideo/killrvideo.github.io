# GET /api/v1/videos/{video_id}/related

## Metadata
- Service: Recommendations
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
- `video_id`: uuid — source video to find related content for

## Query Parameters
- `limit`: integer (default: 5, max: 20) — number of related videos to return

## Response Schema (200)
```json
[
  {
    "videoId": "uuid",
    "title": "string",
    "thumbnailUrl": "string",
    "score": "float (0.0–1.0)"
  }
]
```

Note: Response is a plain array, not a paginated object.

## Error Responses
- 422: Validation error (invalid UUID format, limit > 20)

## Data Model
- Table: videos — content_features column (vector<float, 1536>) for full implementation
- SAI vector index on content_features required for ANN queries

## Key Patterns
- **STUB STATUS**: Currently returns latest videos with random scores, NOT real vector similarity
- Full implementation: fetch source video's content_features, then ANN search with that vector
- Source video must be excluded from results (it is always its own nearest neighbor)
- Fetch limit+1 from ANN query to ensure correct count after source exclusion
- Returns empty array (not 404) when source video has no embedding or no results found
- Limit capped at 20 to prevent expensive unbounded ANN queries
