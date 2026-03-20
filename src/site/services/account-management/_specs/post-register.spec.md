# POST /api/v1/users/register

## Metadata
- Service: Account Management
- Auth: None
- Status Codes: 201, 400, 422

## Request Schema
```json
{ "firstname": "string", "lastname": "string", "email": "string(email)", "password": "string(min:8)" }
```

## Response Schema (201)
```json
{ "userid": "uuid", "firstname": "string", "lastname": "string", "email": "string" }
```

## Error Responses
- 400: Email already registered
- 422: Validation error (missing fields, invalid email format)

## Data Model
- Table: users (partition_key: userid)
- Table: user_credentials (partition_key: email)

## Key Patterns
- Dual-table write, bcrypt hashing, SAI index on email, UUID v4 generation
