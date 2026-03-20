# GET /api/v1/videos/{video_id}/comments

## Metadata
- Service: Comments & Ratings
- Auth: None (public)
- Status Codes: 200, 422

## Path Parameters
- `video_id`: uuid — video to fetch comments for

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
- Table: comments_by_video (partition_key: videoid, clustering_key: commentid DESC)
- Enriched with firstName, lastName from users table (application-level join)

## Key Patterns
- Partition key query on videoid — O(1) node routing
- TimeUUID clustering gives newest-first order without ORDER BY
- Application-level join for user display names
- Page/offset pagination (not cursor-based)
