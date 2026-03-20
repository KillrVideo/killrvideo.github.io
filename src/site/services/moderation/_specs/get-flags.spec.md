# GET /api/v1/moderation/flags

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 422

## Query Parameters
- `status` (optional): FlagStatusEnum — `open`, `under_review`, `approved`, `rejected`
- `page` (optional): integer, default 1
- `page_size` (optional): integer, default 20, max 100

## Response Schema (200)
```json
{
  "items": [
    {
      "flagId": "uuid",
      "userId": "uuid",
      "contentType": "string",
      "contentId": "uuid",
      "reasonCode": "string",
      "reasonText": "string|null",
      "status": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "moderatorId": "uuid|null",
      "moderatorNotes": "string|null",
      "resolvedAt": "timestamp|null"
    }
  ],
  "total": "integer",
  "page": "integer",
  "pageSize": "integer",
  "hasMore": "boolean"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 422: Invalid status value

## Data Model
- Table: flags (partition_key: flagid)
- SAI index: flags_status_idx on status column (required for filtered queries)

## Key Patterns
- SAI index enables efficient status filtering
- Paginated response for large result sets
- Moderator-only access enforced at auth middleware
- Empty result returns 200 with empty items array (not 404)
