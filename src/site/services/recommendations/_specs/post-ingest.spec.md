# POST /api/v1/reco/ingest

## Metadata
- Service: Recommendations
- Auth: creator role (JWT bearer), required
- Status Codes: 202, 401, 403, 404, 422

## Request Schema
```json
{
  "videoId": "uuid",
  "vector": ["float", "...N values (must match vector column dimensionality)"]
}
```

## Response Schema (202)
```json
{
  "videoId": "uuid",
  "status": "string (accepted | failed)",
  "message": "string (optional)"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Token does not have creator role
- 404: Video not found in videos table
- 422: Validation error (invalid UUID, empty vector, wrong vector dimensionality)

## Data Model
- Table: videos — updates only the content_features column (vector<float, 1536>)
- SAI vector index on content_features is updated automatically by Cassandra

## Key Patterns
- Column-level UPDATE — only content_features is written, other video columns unchanged
- Idempotent: repeated calls for same videoId overwrite with last-write-wins semantics
- Pipeline endpoint — called by ML pipeline, not end users
- Returns 202 (not 201) because index propagation may be asynchronous
- Dimension validation must match the vector<float, N> schema declaration exactly
