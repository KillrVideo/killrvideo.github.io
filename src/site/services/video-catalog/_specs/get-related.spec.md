# GET /api/v1/videos/id/{video_id}/related

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| video_id | uuid | Yes | Source video for similarity search |

## Query Parameters
| Name | Type | Required | Default | Constraints |
|------|------|----------|---------|-------------|
| limit | integer | No | 5 | 1–20 |

## Response Schema (200)
```json
[
  {
    "videoId": "uuid",
    "title": "string",
    "thumbnailUrl": "string|null",
    "score": "float(0.0-1.0)"
  }
]
```

## Error Responses
- 422: Validation error (invalid UUID format or limit out of range)

## Notes
- Source video is excluded from results
- Returns empty array if no related videos found
- May return tag-based fallback results if vector embedding not yet available

## Data Model
- Table: video_vectors (partition_key: videoid, vector column: embedding)
- SAI vector index on embedding column (cosine similarity)
- Fallback: videos table with SAI on tags

## Key Patterns
- ANN vector search, cosine similarity scoring, embedding fallback, source video exclusion
