# GET /api/v1/users/me

## Metadata
- Service: Account Management
- Auth: Bearer JWT (viewer role required)
- Status Codes: 200, 401, 403, 404

## Request Schema
- No request body
- Header: `Authorization: Bearer <token>`

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
- 404: User not found (token valid but user deleted)

## Data Model
- Table: users (partition_key: userid)

## Key Patterns
- JWT decode (HS256) → extract sub (userid) → partition key lookup
- Read-only endpoint, no writes
- Dependency injection pattern for auth reuse across endpoints
