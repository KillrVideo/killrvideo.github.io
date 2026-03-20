---
title: "GET /api/v1/moderation/users"
description: "Search and list users for moderation purposes"
endpoint: "/api/v1/moderation/users"
method: "GET"
spec_artifact: "/services/moderation/_specs/get-users.spec.md"
concepts:
  - sai-text-search
  - moderator-tools
  - user-search
  - full-table-access
order: 6
draft: true
---

# GET /api/v1/moderation/users - User Search for Moderation

## Overview

This endpoint allows moderators to search for and list users on the platform. It supports optional free-text search to find users by name or email, and returns full user information useful for moderation decisions.

**Why it exists**: When reviewing flagged content, a moderator often needs to investigate the user who submitted or created the content. This endpoint provides that lookup capability. It also supports role management workflows — moderators use this to find users before promoting or revoking their moderator status.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/moderation/users`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search text — matches against name and email fields |

### Response Body (200)

```json
[
  {
    "userid": "11111111-2222-3333-4444-555555555555",
    "firstname": "Alice",
    "lastname": "Kim",
    "email": "alice.kim@example.com",
    "account_status": "active",
    "roles": ["viewer"],
    "created_date": "2025-09-15T10:00:00Z",
    "last_login_date": "2025-11-01T08:30:00Z"
  },
  {
    "userid": "aaaabbbb-cccc-dddd-eeee-ffffffffffff",
    "firstname": "Bob",
    "lastname": "Kim",
    "email": "bob.kim@example.com",
    "account_status": "active",
    "roles": ["viewer", "moderator"],
    "created_date": "2025-08-01T12:00:00Z",
    "last_login_date": "2025-11-02T07:45:00Z"
  }
]
```

Note: The response is a flat array (not paginated), since moderator user search is intended for targeted lookup rather than bulk listing. Consider adding pagination for large platforms.

## Cassandra Concepts Explained

### SAI Text Search

Without a search query (`?q=`), returning all users is a full table scan — acceptable for small datasets, costly for large ones.

When a search term is provided, SAI's text matching capabilities allow efficient filtering:

```cql
-- Efficient text search using SAI
SELECT * FROM killrvideo.users
WHERE firstname : 'alice'   -- SAI text token match
   OR lastname : 'alice'
   OR email : 'alice';
```

SAI supports several text matching modes:
- **Exact match**: `WHERE firstname = 'Alice'` (equality)
- **Token match**: `WHERE firstname : 'alice'` (case-insensitive word token)
- **Prefix match**: `WHERE email = 'alice%'` (with LIKE support in some configurations)

The token match (`:` operator) is especially useful for name search — it tokenizes the field value and the query term, so `"alice"` matches `"Alice"`, `"ALICE"`, and even partial word matches depending on the analyzer.

### Moderator Tools: Full User Access

Regular users can look up other users' public profiles, but only moderators need access to:
- Email addresses (for account management)
- Account status (for suspension investigations)
- Role assignments (for moderator management)
- Full creation and login dates (for account age verification)

This endpoint is intentionally broader than the public user profile endpoint. Moderators need complete information to do their jobs effectively.

### Handling No-Query vs Search-Query

The endpoint behaves differently based on whether `?q=` is provided:

| Scenario | Behavior |
|----------|----------|
| No `q` param | Return all users (full scan, capped) |
| `q` provided | Filter by text match across name and email fields |
| `q` is empty string | Treat as no filter |

The two cases translate to different CQL queries with different performance profiles.

## Data Model

### Table: `users`

```cql
CREATE TABLE killrvideo.users (
    userid        uuid PRIMARY KEY,
    created_date  timestamp,
    email         text,
    firstname     text,
    lastname      text,
    account_status text,
    last_login_date timestamp
);

-- SAI indexes for search functionality
CREATE CUSTOM INDEX users_firstname_idx
ON killrvideo.users(firstname)
USING 'StorageAttachedIndex'
WITH OPTIONS = {'case_sensitive': 'false', 'normalize': 'true'};

CREATE CUSTOM INDEX users_lastname_idx
ON killrvideo.users(lastname)
USING 'StorageAttachedIndex'
WITH OPTIONS = {'case_sensitive': 'false', 'normalize': 'true'};

CREATE CUSTOM INDEX users_email_idx
ON killrvideo.users(email)
USING 'StorageAttachedIndex';
```

**Key Characteristics**:
- `userid` is the partition key — used by role management endpoints for direct lookup
- SAI indexes on `firstname`, `lastname`, and `email` power the search query
- `case_sensitive: false` and `normalize: true` enable case-insensitive search

## Database Queries

### Without Search Term (All Users)

```python
async def get_all_users():
    users_table = await get_table("users")
    results = await users_table.find(filter={}, limit=100)
    return list(results)
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.users LIMIT 100;
```

**Performance**: Full scan — capped with LIMIT to prevent excessive data return.

### With Search Term

```python
async def search_users(q: str):
    users_table = await get_table("users")

    # Build OR filter across name and email fields
    results = await users_table.find(
        filter={
            "$or": [
                {"firstname": {"$eq": q}},
                {"lastname": {"$eq": q}},
                {"email": {"$eq": q}}
            ]
        },
        limit=50
    )
    return list(results)
```

**Equivalent CQL**:
```cql
-- Requires SAI indexes on firstname, lastname, email
SELECT * FROM killrvideo.users
WHERE firstname = 'kim'
   OR lastname = 'kim'
   OR email = 'kim@example.com'
ALLOW FILTERING;
-- Note: SAI-based OR queries behave differently per driver implementation
```

**Performance**: SAI index scan on each field; result set is merged and deduplicated.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. GET /api/v1/moderation/users?q=kim                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires moderator role                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Parse query parameter                                │
│    ├─ If q present and non-empty: use text search       │
│    └─ If q absent or empty: return all users (capped)   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Query users table                                    │
│    ├─ Search: filter by firstname/lastname/email SAI    │
│    └─ No search: find all with limit cap                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Return 200 with array of User objects                │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Search is Case-Insensitive

SAI indexes configured with `case_sensitive: false` normalize text before indexing. A search for `"kim"` matches `"Kim"`, `"KIM"`, and `"kim"`. This is essential for name search usability.

### 2. Results are Capped

Without pagination, this endpoint caps results (e.g., 50–100 items). Returning thousands of user records in a single response would be slow and wasteful. If the search term is too broad, moderators should be prompted to refine their query.

### 3. Roles Not Stored in `users` Table

User roles (e.g., `["viewer", "moderator"]`) may not be stored in the `users` table itself. They might live in a separate `user_roles` table or be embedded as a set/list column. The response shape includes `roles` as a convenience field assembled by the service layer.

### 4. Email is Sensitive PII

This endpoint exposes email addresses. Ensure it is only accessible to moderators and that access is logged for compliance purposes in production systems.

## Developer Tips

### Common Pitfalls

1. **No result cap on unfiltered query**: Without a LIMIT, `find({})` on a large users table can return millions of records and time out. Always cap unfiltered queries.

2. **Case-sensitive SAI without normalization**: If SAI is configured as case-sensitive, `"alice"` won't match `"Alice"`. Configure `normalize: true` for name fields.

3. **Returning passwords or hashes**: The `users` table doesn't store passwords (those are in `user_credentials`), but double-check that credential data is never included in the response.

4. **Treating empty string as a search**: `?q=` (empty string) should be treated the same as no `q` parameter — return all users, not an empty result set.

### Query Performance Expectations

| Scenario | Performance | Why |
|----------|-------------|-----|
| No filter (all users, capped) | 20–100ms | Full scan with LIMIT |
| Search by name (SAI) | < 30ms | Index scan, selective |
| Search by email (SAI) | < 10ms | High selectivity, fast |

## Related Endpoints

- [POST /api/v1/moderation/users/{user_id}/assign-moderator](/services/moderation/post-assign-moderator/) - Promote a user found via this search
- [POST /api/v1/moderation/users/{user_id}/revoke-moderator](/services/moderation/post-revoke-moderator/) - Revoke moderator role from a user
