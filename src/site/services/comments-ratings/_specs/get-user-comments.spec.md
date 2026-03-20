# GET /api/v1/users/{user_id}/comments

## Metadata
- Service: Comments & Ratings
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
- `user_id`: uuid — user whose comment history to retrieve

## Query Parameters
- `page`: integer (default: 1) — 1-based page number
- `pageSize`: integer (default: 10) — items per page

## Response Schema (200)
```json
{
  "items": [
    {
      "commentid": "timeuuid",
      "videoid": "uuid",
      "userid": "uuid",
      "comment": "string",
      "sentiment_score": "float | null",
      "firstName": "string",
      "lastName": "string"
    }
  ],
  "total": "integer",
  "page": "integer",
  "pageSize": "integer"
}
```

## Error Responses
- 422: Validation error (invalid UUID format, invalid pagination params)

## Data Model
- Table: comments_by_user (partition_key: userid, clustering_key: commentid DESC)
- Single user lookup for firstName/lastName (all rows belong to same user)

## Key Patterns
- Mirror table of comments_by_video with userid as partition key
- Denormalization: same data written to two tables at POST time
- One user enrichment lookup for entire page (vs N lookups in get-video-comments)
- Returns empty list (not 404) when user has no comments or does not exist
