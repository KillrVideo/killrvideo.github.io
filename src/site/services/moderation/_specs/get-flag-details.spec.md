# GET /api/v1/moderation/flags/{flag_id}

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `flag_id`: uuid — unique identifier of the flag

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
  "moderatorId": "uuid|null",
  "moderatorNotes": "string|null",
  "resolvedAt": "timestamp|null"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 404: Flag not found
- 422: Invalid UUID format for flag_id

## Data Model
- Table: flags (partition_key: flagid)
- Query type: partition key lookup (O(1))

## Key Patterns
- Direct partition key lookup — no index required
- UUID path parameter validated before DB query
- Returns 404 (not 200 with null) when flag not found
- Identical FlagResponse schema as list endpoint
