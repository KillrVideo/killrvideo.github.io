# GET /api/v1/recommendations/foryou

## Metadata
- Service: Recommendations
- Auth: viewer role (JWT bearer), required
- Status Codes: 200, 401, 403

## Query Parameters
- `page`: integer (default: 1) — 1-based page number
- `pageSize`: integer (default: 10) — items per page

## Response Schema (200)
```json
{
  "items": [
    {
      "videoId": "uuid",
      "title": "string",
      "thumbnailUrl": "string",
      "description": "string",
      "tags": ["string"],
      "addedDate": "timestamp (ISO-8601)",
      "userId": "uuid"
    }
  ],
  "total": "integer",
  "page": "integer",
  "pageSize": "integer"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Token does not have viewer role

## Data Model
- Table: videos — content_features column (vector<float, 1536>)
- SAI vector index on content_features required for ANN queries
- User preference vector retrieved from user profile or watch history

## Key Patterns
- ANN (Approximate Nearest Neighbor) search using HNSW via Cassandra vector index
- User preference vector as query vector: ORDER BY content_features ANN OF <vector>
- Cold start fallback: return trending/popular videos when no preference vector exists
- Over-fetch then filter: fetch extra results to accommodate post-processing filters
- Watched video exclusion applied in application layer after ANN query
