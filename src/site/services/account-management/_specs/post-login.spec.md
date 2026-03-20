# POST /api/v1/users/login

## Metadata
- Service: Account Management
- Auth: None (credentials in body)
- Status Codes: 200, 401, 422

## Request Schema
```json
{ "email": "string(email)", "password": "string" }
```

## Response Schema (200)
```json
{
  "token": "string(jwt)",
  "user": {
    "userId": "uuid",
    "firstname": "string",
    "lastname": "string",
    "email": "string",
    "account_status": "string",
    "created_date": "string(iso8601)",
    "last_login_date": "string(iso8601)"
  }
}
```

## Error Responses
- 401: Incorrect email or password (intentionally vague)
- 422: Validation error

## Data Model
- Table: user_credentials (partition_key: email) - credential lookup
- Table: users (partition_key: userid) - profile fetch + last_login update

## Key Patterns
- Multi-table lookup: credentials by email → profile by userid
- bcrypt verification (~100-300ms intentional delay)
- JWT HS256, 24h expiry, sub=userid, roles=[account_status]
- UPDATE last_login_date after successful auth
