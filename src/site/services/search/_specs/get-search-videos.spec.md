# GET /api/v1/search/videos

## Metadata
- Service: Search
- Auth: None (public endpoint)
- Status Codes: 200, 422

## Request Schema
- Query params: `query` (string, required), `mode` (string: "semantic"|"keyword", default: "keyword"), `page` (int, default: 1), `pageSize` (int, 1-100, default: 10)

## Response Schema (200)
```json
{
  "data": [
    {
      "videoid": "uuid",
      "name": "string",
      "description": "string",
      "preview_image_location": "string",
      "userid": "uuid",
      "added_date": "string(iso8601)",
      "tags": ["string"],
      "$similarity": "float(0-1, semantic mode only)"
    }
  ],
  "pagination": {
    "currentPage": "int",
    "pageSize": "int",
    "totalItems": "int",
    "totalPages": "int"
  }
}
```

## Error Responses
- 422: Missing or invalid query parameters

## Data Model
- Table: videos (partition_key: videoid)
- Index: videos_content_features_idx (SAI vector, COSINE, nv-qa-4 model, 4096 dims)
- Index: videos_name_idx (SAI text)

## Key Patterns
- Semantic: ANN vector search via $vectorize, overfetch 3x + client-side threshold filter (0.7)
- Keyword: SAI regex filter on name, case-insensitive
- Feature flag: VECTOR_SEARCH_ENABLED controls semantic availability
- Embeddings: NVIDIA NV-Embed-QA, 512 token limit, text clipped before insertion
