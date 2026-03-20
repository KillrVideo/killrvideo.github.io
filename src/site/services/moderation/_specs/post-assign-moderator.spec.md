# POST /api/v1/moderation/users/{user_id}/assign-moderator

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403, 404, 422

## Path Parameters
- `user_id`: uuid — user to promote to moderator

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
- Update: roles column — add "moderator" (additive, preserves existing roles)

## Key Patterns
- Read-then-write: fetch user to verify existence, then update
- Idempotent: assigning moderator to existing moderator has no effect
- Additive role update: SET roles = roles + {'moderator'}
- Role change takes effect for user's next login (JWT must be refreshed)
- Never overwrite entire roles list — use additive update
