---
title: "POST /api/v1/moderation/users/{user_id}/assign-moderator"
description: "Grant moderator role to a user"
endpoint: "/api/v1/moderation/users/{user_id}/assign-moderator"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-assign-moderator.spec.md"
concepts:
  - role-promotion
  - rbac-management
  - updating-user-roles
  - set-data-type
order: 7
draft: true
---

# POST /api/v1/moderation/users/{user_id}/assign-moderator - Assign Moderator Role

## Overview

This endpoint grants the `moderator` role to an existing user, giving them access to the moderation queue and the ability to act on flags. The operation is performed by an existing moderator and is idempotent — assigning moderator status to someone who is already a moderator has no effect.

**Why it exists**: The platform needs a controlled mechanism for expanding the moderator team. Rather than direct database manipulation, this endpoint provides an auditable, role-protected API for role promotion. Only current moderators can grant moderator status to others.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/moderation/users/{user_id}/assign-moderator`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK
- **Body**: None required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | uuid | User to promote to moderator |

### Response Body (200)

```json
{
  "userid": "11111111-2222-3333-4444-555555555555",
  "firstname": "Alice",
  "lastname": "Kim",
  "email": "alice.kim@example.com",
  "account_status": "active",
  "roles": ["viewer", "moderator"],
  "created_date": "2025-09-15T10:00:00Z",
  "last_login_date": "2025-11-01T08:30:00Z"
}
```

Note that `roles` now includes both `"viewer"` and `"moderator"` — the user retains their existing roles.

## Cassandra Concepts Explained

### Updating Collection Columns (Sets)

If roles are stored as a Cassandra `set<text>` column, adding a role is an additive operation:

```cql
-- Add "moderator" to the roles set without overwriting other roles
UPDATE killrvideo.users
SET roles = roles + {'moderator'}
WHERE userid = 11111111-2222-3333-4444-555555555555;
```

This is a key Cassandra feature: set, list, and map columns support atomic element-level operations. You don't need to read the current set, add your value, and write the whole set back. The `roles + {'moderator'}` syntax tells Cassandra to add just that one element.

This also makes the operation naturally idempotent: adding `"moderator"` to a set that already contains `"moderator"` is a no-op.

### RBAC Management Patterns

In application-layer RBAC (as opposed to database-level), roles are just data in a table. The key design decisions are:

1. **Where roles live**: Embedded in the user row (as a set/list), or in a separate `user_roles` table
2. **How roles are checked**: At the JWT level (roles baked into the token) or at query time (roles fetched from DB on each request)
3. **How role changes propagate**: Immediate (if checked from DB) or delayed (if embedded in JWT until token expiry)

KillrVideo embeds roles in the user row and includes them in JWT claims. This means a newly promoted moderator needs to log out and back in for their new JWT to include the `moderator` role. This is a common trade-off between performance (no DB lookup per request) and immediacy (role changes reflected instantly).

### Read-Modify-Write Pattern

Role assignment follows a read-modify-write pattern:

1. Read the current user record (verify user exists)
2. Modify the roles (add `"moderator"`)
3. Write back to the database

If roles are stored as a Cassandra set, step 2 and 3 can be combined into a single atomic update (`SET roles = roles + {'moderator'}`). If roles are stored as a regular list field in the Data API, a read-then-update approach is needed.

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
    last_login_date timestamp,
    roles         set<text>   -- e.g., {'viewer'}, {'viewer', 'moderator'}
);
```

**Alternative** (if using Data API with list stored as JSON):
```cql
-- Roles stored as JSON text in a text column, or as separate user_roles table
```

## Database Queries

### 1. Fetch User (Verify Exists)

```python
async def get_user_by_id(user_id: str):
    users_table = await get_table("users")
    user = await users_table.find_one(filter={"userid": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.users WHERE userid = 11111111-2222-3333-4444-555555555555;
```

### 2. Add Moderator Role

```python
async def assign_moderator_role(user_id: str):
    users_table = await get_table("users")

    # Fetch current user
    user = await get_user_by_id(user_id)

    # Build updated roles list (ensure moderator is present)
    current_roles = set(user.get("roles", ["viewer"]))
    current_roles.add("moderator")

    await users_table.update_one(
        filter={"userid": user_id},
        update={"$set": {"roles": list(current_roles)}}
    )

    # Return updated user
    user["roles"] = list(current_roles)
    return user
```

**Equivalent CQL (with set type)**:
```cql
UPDATE killrvideo.users
SET roles = roles + {'moderator'}
WHERE userid = 11111111-2222-3333-4444-555555555555;
```

**Performance**: O(1) — partition key read + write

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. POST /api/v1/moderation/users/{user_id}/assign-mod   │
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
│ 3. Validate path parameter                              │
│    └─ user_id must be valid UUID                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Fetch user to verify exists                          │
│    └─ Return 404 if not found                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Add "moderator" to user's roles                      │
│    └─ Idempotent: already moderator → no change         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. UPDATE users SET roles = roles + {'moderator'}       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 200 with updated User object                  │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Idempotency

Assigning moderator role to an existing moderator should not fail or cause side effects. Using a set union (`roles + {'moderator'}`) ensures idempotency naturally. If using a list with the Data API, check before adding to avoid duplicates.

### 2. JWT Token Propagation Delay

After this endpoint runs, the user's database record is updated immediately. However, if the user currently has a JWT without the `moderator` role, they won't gain moderator access until they log out and back in (generating a new JWT that includes the updated role from the database). This is a known limitation of stateless JWTs.

### 3. Self-Assignment Prevention

Should a moderator be able to assign moderator status to themselves? The current schema does not prevent this explicitly. For stronger governance, add a check that `current_user.userid != user_id`.

### 4. Audit Logging

For compliance, role assignments should be logged with who performed the action and when. The current `users` table does not have an audit log for role changes. Consider a separate `role_change_audit` table for production use.

## Developer Tips

### Common Pitfalls

1. **Overwriting the entire roles list**: If you do `SET roles = ['moderator']` instead of `SET roles = roles + {'moderator'}`, you'll wipe out the user's existing roles (e.g., `viewer`). Always use additive operations.

2. **Not verifying the target user exists**: Updating a non-existent user in Cassandra creates a ghost row (empty partition). Always fetch first, then update.

3. **Returning stale roles from the fetch**: Read the user before updating, add the role programmatically, and return the constructed response rather than making a second DB read after the update.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch user | < 5ms | Partition key lookup |
| Update roles | < 5ms | Partition key write |
| Total | < 15ms | Two partition key operations |

## Related Endpoints

- [GET /api/v1/moderation/users](/services/moderation/get-users/) - Find the user to promote
- [POST /api/v1/moderation/users/{user_id}/revoke-moderator](/services/moderation/post-revoke-moderator/) - Reverse this operation
