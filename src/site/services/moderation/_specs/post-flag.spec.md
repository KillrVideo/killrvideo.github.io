# POST /api/v1/flags

## Metadata
- Service: Moderation
- Auth: viewer role (JWT required)
- Status Codes: 201, 400, 401, 403, 422

## Request Schema
```json
{
  "contentType": "video|comment",
  "contentId": "uuid",
  "reasonCode": "spam|inappropriate|harassment|copyright|other",
  "reasonText": "string(optional, max:500)"
}
```

## Response Schema (201)
```json
{
  "flagId": "uuid",
  "userId": "uuid",
  "contentType": "string",
  "contentId": "uuid",
  "reasonCode": "string",
  "reasonText": "string|null",
  "status": "open",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "moderatorId": null,
  "moderatorNotes": null,
  "resolvedAt": null
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires viewer minimum)
- 422: Validation error (invalid contentType, invalid reasonCode, reasonText > 500 chars)

## Data Model
- Table: flags (partition_key: flagid)
- SAI index: flags_status_idx on status column
- SAI index: flags_contentid_idx on contentid column

## Key Patterns
- UUID v4 generation for flagId
- Status always initialized to "open"
- Moderator fields (moderatorId, moderatorNotes, resolvedAt) are null at creation
- Single partition write, O(1) performance
