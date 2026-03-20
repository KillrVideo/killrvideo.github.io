# GET /api/v1/search/tags/suggest

## Metadata
- Service: Search
- Auth: None (public)
- Status Codes: 200, 422

## Query Parameters
| Name | Type | Required | Default | Constraints |
|------|------|----------|---------|-------------|
| query | string | Yes | — | Min length 1 |
| limit | integer | No | 10 | 1–25 |

## Response Schema (200)
```json
[
  { "tag": "string" }
]
```

## Notes
- Returns empty array (not 404) when no tags match
- query parameter is required; missing or empty query returns 422

## Error Responses
- 422: Validation error (missing query, empty query, limit out of range)

## Data Model
- Table: tags (partition_key: tag, usage_count for sorting)
- SAI text index on tag column for prefix matching

## Key Patterns
- Autocomplete/type-ahead pattern, prefix matching, SAI text search, query normalization to lowercase, response is bare array
