# GET /api/v1/moderation/users

## Metadata
- Service: Moderation
- Auth: moderator role (JWT required)
- Status Codes: 200, 401, 403

## Query Parameters
- `q` (optional): string — search term for name/email text search

## Response Schema (200)
```json
[
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
]
```

## Error Responses
- 401: Missing or invalid JWT token
- 403: Insufficient role (requires moderator)

## Data Model
- Table: users (partition_key: userid)
- SAI indexes: users_firstname_idx, users_lastname_idx, users_email_idx

## Key Patterns
- Optional q parameter: if absent/empty, return all users (capped at 50-100)
- If q present: SAI text search across firstname, lastname, email
- Case-insensitive search via SAI normalize option
- Response is array (not paginated object) — add pagination for large platforms
- Includes email (PII) — moderator-only access is critical
