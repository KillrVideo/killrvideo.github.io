---
title: "PUT /api/v1/users/me"
description: "Update the current authenticated user's profile"
endpoint: "/api/v1/users/me"
method: "PUT"
spec_artifact: "/services/account-management/_specs/put-me.spec.md"
concepts:
  - partial-updates
  - cassandra-upsert
  - jwt-authentication
  - refetch-pattern
order: 5
---

# PUT /api/v1/users/me - Update Current User Profile

## Overview

This endpoint allows authenticated users to update their own profile information (firstname, lastname). It demonstrates Cassandra's UPDATE operation and partial document updates.

**Why it exists**: Users need to maintain their profile information. This endpoint provides self-service profile management without admin intervention.

## HTTP Details

- **Method**: PUT
- **Path**: `/api/v1/users/me`
- **Auth Required**: Yes (requires `viewer` role minimum)
- **Success Status**: 200 OK

### Request Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Request Body

```json
{
  "firstname": "Jane",
  "lastname": "Smith"
}
```

**Note**: All fields are optional. Send only fields you want to update.

### Response Body

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "firstname": "Jane",
  "lastname": "Smith",
  "email": "john.doe@example.com",
  "account_status": "viewer",
  "created_date": "2025-10-31T10:30:00Z",
  "last_login_date": "2025-10-31T14:22:15Z"
}
```

## Cassandra Concepts Explained

### Partial Updates with $set

Cassandra allows updating specific columns without touching others:

```python
update_fields = {"firstname": "Jane", "lastname": "Smith"}

await table.update_one(
    filter={"userid": user_id},
    update={"$set": update_fields}
)
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.users
SET firstname = 'Jane', lastname = 'Smith'
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**What happens to other columns?**
- **Not affected**: `email`, `created_date`, `account_status` remain unchanged
- **Cassandra writes are column-level**, not row-level
- Each column has its own timestamp (last-write-wins conflict resolution)

### UPDATE vs INSERT in Cassandra

**In SQL databases**: UPDATE fails if row doesn't exist

**In Cassandra**: UPDATE creates the row if it doesn't exist (upsert behavior)

```cql
-- If userid doesn't exist, this creates a new row with only firstname/lastname
UPDATE killrvideo.users
SET firstname = 'Jane'
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Why?** Cassandra's distributed nature makes "check then write" expensive. Upsert semantics are simpler and faster.

**Implication for this endpoint**: We should verify user exists first (which we do via `get_current_viewer` dependency).

### The Refetch Pattern

After updating, the code refetches the document:

```python
await table.update_one(...)                       # Update
updated_user_doc = await table.find_one(...)      # Refetch
return User.model_validate(updated_user_doc)      # Return updated data
```

**Why refetch?**
- UPDATE doesn't return the updated row (unlike SQL's RETURNING clause)
- We want to return the complete, fresh user object
- Ensures client sees exactly what's in the database

## Data Model

### Table: `users`

```cql
CREATE TABLE killrvideo.users (
    userid uuid PRIMARY KEY,
    created_date timestamp,
    email text,
    firstname text,
    lastname text,
    account_status text,
    last_login_date timestamp
);
```

**Updatable fields** (for this endpoint): `firstname`, `lastname`

**Protected fields** (cannot be updated via this endpoint):
- `userid` - Partition key, immutable
- `email` - Requires verification flow (not implemented)
- `account_status` - Only moderators can change roles
- `created_date` - Historical record, should never change

## Database Queries

### 1. Get Current User (from JWT)

**Dependency**: `get_current_viewer()` - See [GET /users/me](/services/account-management/get-me/)

**Result**: Authenticated User object with `userId`

### 2. Build Update Document

```python
async def update_user_in_table(
    user_id: UUID,
    update_data: UserProfileUpdateRequest
):
    # Only include fields that were actually provided
    update_fields = update_data.model_dump(exclude_unset=True, by_alias=False)

    if not update_fields:
        # Nothing to update, just return current user
        return await get_user_by_id_from_table(user_id=user_id)
```

**Example**:
```python
# Request: {"firstname": "Jane"}
update_fields = {"firstname": "Jane"}  # lastname not included

# Request: {"firstname": "Jane", "lastname": "Smith"}
update_fields = {"firstname": "Jane", "lastname": "Smith"}

# Request: {}
update_fields = {}  # No update needed
```

**Pydantic magic**: `exclude_unset=True` only includes fields present in the request

### 3. Perform Update

```python
await table.update_one(
    filter={"userid": user_id},
    update={"$set": update_fields}
)
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.users
SET firstname = 'Jane', lastname = 'Smith'
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: **O(1)** - Direct partition key write (~10ms)

### 4. Refetch Updated User

```python
updated_user_doc = await table.find_one(filter={"userid": user_id})

if not updated_user_doc:
    return None  # Should never happen

return User.model_validate(updated_user_doc)
```

**Equivalent CQL**:
```cql
SELECT *
FROM killrvideo.users
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: **O(1)** - Direct partition key read (~5ms)

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends PUT /api/v1/users/me                     │
│    Header: Authorization: Bearer <JWT>                   │
│    Body: {firstname: "Jane", lastname: "Smith"}          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. get_current_viewer dependency executes                │
│    ├─ Validates JWT                                      │
│    ├─ Fetches user from database                         │
│    └─ Returns User object (injected to endpoint)         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Pydantic validates request body                       │
│    UserProfileUpdateRequest(firstname, lastname)         │
│    ├─ Invalid data? → 422 Validation Error               │
│    └─ Valid? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Extract only provided fields                          │
│    update_fields = model_dump(exclude_unset=True)        │
│    └─ Empty? → Return current user (no update)           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Update user record                                    │
│    UPDATE users SET firstname=?, lastname=?              │
│    WHERE userid = current_user.userId                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Refetch updated record                                │
│    SELECT * FROM users WHERE userid = ?                  │
│    └─ Not found? → 404 (should never happen)             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 7. Return 200 OK with complete user object               │
└──────────────────────────────────────────────────────────┘
```

**Total Queries**: 3 (1 SELECT from auth dependency, 1 UPDATE, 1 SELECT for refetch)

**Expected Latency**: 20-30ms

## Special Notes

### 1. Why Email is Not Updatable

**Security considerations**:
- Email is used for login (changing it requires verification)
- Could enable account takeover if not properly verified
- Should send verification email to both old and new addresses

**Proper email update flow**:
1. User requests email change
2. System sends verification code to NEW email
3. User enters code from new email
4. System sends notification to OLD email
5. Update completes after both verifications

Not implemented in this reference app for simplicity.

### 2. Optimistic Updates

**Client-side pattern**:
```javascript
// Update UI immediately (optimistic)
setUser({...user, firstname: "Jane"})

try {
    // Send update to server
    const response = await fetch('/api/v1/users/me', {
        method: 'PUT',
        body: JSON.stringify({firstname: "Jane"})
    })

    // Replace with server's response (source of truth)
    setUser(await response.json())
} catch (error) {
    // Rollback optimistic update
    setUser(user)  // Restore original
}
```

**Benefits**: UI feels instant, even with network latency

### 3. Partial Update Validation

**Challenge**: Pydantic validates complete models, but we want partial updates

**Solution**: Make all fields optional in the update model

```python
class UserProfileUpdateRequest(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
```

**With validation**:
```python
class UserProfileUpdateRequest(BaseModel):
    firstname: Optional[str] = Field(None, min_length=1, max_length=50)
    lastname: Optional[str] = Field(None, min_length=1, max_length=50)
```

### 4. The Empty Update Case

**What if client sends `{}`?**

```python
update_fields = update_data.model_dump(exclude_unset=True)

if not update_fields:
    # No fields to update, just return current user
    return await get_user_by_id_from_table(user_id=user_id)
```

**Result**:
- No UPDATE query executed
- Returns current user data
- Still returns 200 OK (idempotent operation)

**Why handle this?** Avoids unnecessary database write.

### 5. Last-Write-Wins Semantics

**Scenario**: Two clients update the same user simultaneously

```
Time 0: User has {firstname: "John"}
Time 1: Client A sets firstname = "Jane"
Time 2: Client B sets firstname = "Jack"
Result: firstname = "Jack" (last write wins)
```

**Cassandra resolution**:
- Each write has a timestamp
- Newest timestamp wins during conflicts
- No locking, no blocking

**Alternative**: Conditional updates with version numbers
```python
await table.update_one(
    filter={"userid": user_id, "version": current_version},
    update={"$set": {...}, "$inc": {"version": 1}}
)
```

**Trade-off**: Prevents conflicts but requires retry logic.

## Developer Tips

### Common Pitfalls

1. **Allowing email updates without verification**: Security risk

2. **Not using exclude_unset**: Would set omitted fields to null

3. **Forgetting to refetch**: Client sees stale data

4. **Exposing internal fields**: Don't allow updating `account_status` here

5. **No input validation**: Always validate string lengths, formats, etc.

### Best Practices

1. **Use separate models for requests and responses**:
   ```python
   UserProfileUpdateRequest  # Only updatable fields
   User                       # Complete user object
   ```

2. **Validate string lengths**: Prevent database bloat
   ```python
   firstname: str = Field(max_length=50)
   ```

3. **Sanitize input**: Strip whitespace, normalize unicode
   ```python
   firstname: str = Field(..., strip_whitespace=True)
   ```

4. **Return updated object**: Keeps client in sync with server

### Performance Optimization

**Current**: Sequential UPDATE then SELECT
```python
await update()  # 10ms
await select()  # 5ms
# Total: 15ms
```

**Alternative**: Skip refetch, construct response manually
```python
current_user.firstname = update_data.firstname
current_user.lastname = update_data.lastname
return current_user
# Total: 10ms (33% faster)
```

**Trade-off**: Slightly stale data if concurrent updates occur.

### Testing Tips

```python
# Test successful update
async def test_update_profile():
    token = await get_auth_token()

    response = await client.put(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"firstname": "NewName"}
    )

    assert response.status_code == 200
    assert response.json()["firstname"] == "NewName"

# Test partial update
async def test_partial_update():
    token = await get_auth_token()

    # Update only firstname
    response = await client.put(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"firstname": "Jane"}
    )

    user = response.json()
    assert user["firstname"] == "Jane"
    assert user["lastname"] == "Doe"  # Unchanged

# Test empty update
async def test_empty_update():
    token = await get_auth_token()

    response = await client.put(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={}
    )

    assert response.status_code == 200  # Still succeeds
```

## Related Endpoints

- [GET /api/v1/users/me](/services/account-management/get-me/) - View current profile
- [POST /api/v1/users/login](/services/account-management/post-login/) - Authenticate first
- [GET /api/v1/users/{user_id}](/services/account-management/get-user-by-id/) - View other profiles

## Further Learning

- [Pydantic Partial Models](https://docs.pydantic.dev/latest/concepts/models/#partial-models)
- [Cassandra Last-Write-Wins](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html#tunable-consistency)
- [HTTP PUT vs PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT)
- [Optimistic UI Updates](https://www.apollographql.com/docs/react/performance/optimistic-ui/)
