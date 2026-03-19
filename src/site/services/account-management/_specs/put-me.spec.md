# PUT /api/v1/users/me

## Metadata
- Service: Account Management
- Auth: Bearer JWT (viewer role required)
- Status Codes: 200, 401, 403, 422

## Request Schema
```json
{ "firstname": "string(optional)", "lastname": "string(optional)" }
```
All fields optional. Empty body returns current user unchanged.

## Response Schema (200)
```json
{
  "userId": "uuid",
  "firstname": "string",
  "lastname": "string",
  "email": "string",
  "account_status": "string",
  "created_date": "string(iso8601)",
  "last_login_date": "string(iso8601)"
}
```

## Error Responses
- 401: Missing or invalid JWT
- 403: Missing Authorization header
- 422: Validation error (e.g., empty string for firstname)

## Data Model
- Table: users (partition_key: userid)

## Key Patterns
- Partial update via $set (only provided fields updated)
- Pydantic exclude_unset=True prevents null-overwriting omitted fields
- Refetch after update (UPDATE has no RETURNING in Cassandra)
- Protected fields: userid, email, account_status, created_date
- Last-write-wins semantics for concurrent updates
