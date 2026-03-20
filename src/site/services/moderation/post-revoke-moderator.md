---
title: "POST /api/v1/moderation/users/{user_id}/revoke-moderator"
description: "Revoke moderator role from a user"
endpoint: "/api/v1/moderation/users/{user_id}/revoke-moderator"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-revoke-moderator.spec.md"
concepts:
  - role-demotion
  - privilege-management
  - set-subtraction
  - idempotent-operations
order: 8
draft: true
---

# POST /api/v1/moderation/users/{user_id}/revoke-moderator - Revoke Moderator Role

## Overview

This endpoint removes the `moderator` role from a user, returning them to standard viewer status. It is the counterpart to [POST /api/v1/moderation/users/{user_id}/assign-moderator](/services/moderation/post-assign-moderator/).

**Why it exists**: Moderator privileges should be revocable. Staff turnover, policy violations, or simply reducing the moderation team all require a way to demote users. Like assignment, revocation is performed through a role-protected API to ensure only current moderators can manage team membership.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/moderation/users/{user_id}/revoke-moderator`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK
- **Body**: None required

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | uuid | User whose moderator role should be revoked |

### Response Body (200)

```json
{
  "userid": "11111111-2222-3333-4444-555555555555",
  "firstname": "Alice",
  "lastname": "Kim",
  "email": "alice.kim@example.com",
  "account_status": "active",
  "roles": ["viewer"],
  "created_date": "2025-09-15T10:00:00Z",
  "last_login_date": "2025-11-01T08:30:00Z"
}
```

Note that `roles` now contains only `["viewer"]` — the `moderator` role has been removed while other roles are preserved.

## Cassandra Concepts Explained

### Set Subtraction in Cassandra

The counterpart to `roles + {'moderator'}` is the set subtraction operator:

```cql
-- Remove "moderator" from the roles set without affecting other roles
UPDATE killrvideo.users
SET roles = roles - {'moderator'}
WHERE userid = 11111111-2222-3333-4444-555555555555;
```

Cassandra's set subtraction is atomic and idempotent. Removing an element that doesn't exist in the set is a no-op — it does not raise an error.

This is a powerful property for role management: you can confidently call this endpoint multiple times and know the final state will be consistent.

### Privilege Management Considerations

Role revocation is typically more sensitive than role assignment:

1. **What happens to in-progress work?** If a moderator has flags `under_review`, revoking their role doesn't automatically reassign those flags. The flags remain in `under_review` with their moderator ID, but the user can no longer access the moderation endpoints.

2. **Active session invalidation**: If the user is currently logged in with a JWT containing the `moderator` role, their existing token remains valid until expiry. True immediate revocation would require token blacklisting, which adds complexity.

3. **Audit trail**: Who revoked the role and when? This information is not captured by the current `users` table schema.

### Idempotent Operations

Both assign and revoke are idempotent:
- Assigning moderator to an existing moderator: no change
- Revoking moderator from a non-moderator: no change

This makes them safe to retry on network failures without worrying about double-execution side effects.

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

### 2. Remove Moderator Role

```python
async def revoke_moderator_role(user_id: str):
    users_table = await get_table("users")

    user = await get_user_by_id(user_id)

    # Build updated roles list (ensure moderator is absent)
    current_roles = set(user.get("roles", ["viewer"]))
    current_roles.discard("moderator")  # discard is safe even if not present

    # Always ensure "viewer" remains
    if not current_roles:
        current_roles.add("viewer")

    await users_table.update_one(
        filter={"userid": user_id},
        update={"$set": {"roles": list(current_roles)}}
    )

    user["roles"] = list(current_roles)
    return user
```

**Equivalent CQL (with set type)**:
```cql
UPDATE killrvideo.users
SET roles = roles - {'moderator'}
WHERE userid = 11111111-2222-3333-4444-555555555555;
```

**Performance**: O(1) — partition key read + write

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. POST /api/v1/moderation/users/{user_id}/revoke-mod   │
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
│ 5. Remove "moderator" from roles                        │
│    └─ Idempotent: non-moderator → no change             │
│    └─ Ensure "viewer" always remains                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. UPDATE users SET roles = roles - {'moderator'}       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 200 with updated User object                  │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Preserve Other Roles

Revocation should only remove `"moderator"` — not all roles. A user demoted from moderator should still have `"viewer"` access. Using the subtraction operator (`roles - {'moderator'}`) ensures other roles are untouched.

### 2. Prevent Empty Roles

If somehow a user's roles set becomes empty after revocation (e.g., in a non-standard schema state), always ensure at least `"viewer"` remains. An empty roles set could prevent the user from doing anything on the platform.

### 3. Self-Revocation

A moderator can revoke their own moderator status. This is valid and may be intentional (voluntary step-down). However, if there is only one moderator and they revoke themselves, the platform would have no moderators. Consider adding a minimum moderator count check for production systems.

### 4. Active Sessions Still Valid

After revocation, the user's existing JWT token continues to include the `moderator` role until it expires. The user can continue exercising moderator privileges until their next login. For immediate revocation, implement a token blacklist or short token TTL.

## Developer Tips

### Common Pitfalls

1. **Wiping all roles**: Never do `SET roles = ['viewer']`. Use subtraction to remove only the target role. Another moderator role might exist in a more complex role hierarchy.

2. **Using `remove` instead of `discard`**: Python's `set.remove()` raises a `KeyError` if the element isn't present. Use `set.discard()` which is safe for non-existent elements.

3. **Race condition on last moderator**: Two concurrent requests to revoke the last moderator could both succeed. Add a count check before revoking if minimum-moderator enforcement is required.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch user | < 5ms | Partition key lookup |
| Update roles | < 5ms | Partition key write |
| Total | < 15ms | Two partition key operations |

## Related Endpoints

- [POST /api/v1/moderation/users/{user_id}/assign-moderator](/services/moderation/post-assign-moderator/) - The reverse operation
- [GET /api/v1/moderation/users](/services/moderation/get-users/) - Find users by name/email
