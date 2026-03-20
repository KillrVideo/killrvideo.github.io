# POST /api/v1/moderation/flags/{flag_id}/action

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `flag_id`: uuid — flag to act on

## Request Schema
```json
{
  "status": "open|under_review|approved|rejected",
  "moderatorNotes": "string(optional, max:1000)"
}
```

## Response Schema (200)
```json
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
  "moderatorId": "uuid",
  "moderatorNotes": "string|null",
  "resolvedAt": "timestamp|null"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 404: Flag not found
- 422: Invalid status value, moderatorNotes > 1000 chars

## Data Model
- Table: flags (partition_key: flagid)
- Updates: status, moderatorid, moderatornotes, updatedat, resolvedat (if terminal)

## Key Patterns
- Read-then-write pattern (fetch flag, verify exists, then update)
- moderatorId always sourced from JWT, not request body
- resolvedAt set only when status is "approved" or "rejected"
- updatedAt always set to current timestamp on every update
- Single partition read + write, O(1) performance
