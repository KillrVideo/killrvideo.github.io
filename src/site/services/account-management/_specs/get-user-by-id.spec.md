# GET /api/v1/users/{user_id}

## Metadata
- Service: Account Management
- Auth: None (public endpoint)
- Status Codes: 200, 404, 422

## Request Schema
- Path parameter: `user_id` (UUID format required)
- No request body

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
- 404: User not found
- 422: Invalid UUID format in path parameter

## Data Model
- Table: users (partition_key: userid)

## Key Patterns
- Single O(1) partition key lookup by UUID
- No auth required (public endpoint)
- Ideal caching candidate (Cache-Control: public, max-age=300)
- UUID format validated automatically by framework path parameter typing
