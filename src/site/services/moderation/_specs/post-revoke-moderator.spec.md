# POST /api/v1/moderation/users/{user_id}/revoke-moderator

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `user_id`: uuid — user whose moderator role should be revoked

## Request Body
None required.

## Response Schema (200)
```json
{
  "userid": "uuid",
  "firstname": "string",
  "lastname": "string",
  "email": "string",
  "account_status": "string",
  "roles": ["string"],
  "created_date": "timestamp",
  "last_login_date": "timestamp|null"
}
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)
- 404: User not found
- 422: Invalid UUID format for user_id

## Data Model
- Table: users (partition_key: userid)
- Update: roles column — remove "moderator" (subtractive, preserves other roles)

## Key Patterns
- Read-then-write: fetch user to verify existence, then update
- Idempotent: revoking from non-moderator has no effect
- Subtractive role update: SET roles = roles - {'moderator'}
- Always preserve "viewer" role — never leave roles empty
- Role change takes effect for user's next login (JWT must be refreshed)
- Self-revocation is allowed (moderator can demote themselves)
