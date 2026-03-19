---
title: "POST /api/v1/users/register"
description: "Create a new user account"
endpoint: "/api/v1/users/register"
method: "POST"
spec_artifact: "/services/account-management/_specs/post-register.spec.md"
concepts:
  - partition-keys
  - sai-indexes
  - uuid-generation
  - password-hashing
  - dual-table-writes
order: 2
---

# POST /api/v1/users/register - User Registration

## Overview

This endpoint creates a new user account in the KillrVideo platform. It handles the complete registration flow including validation, password hashing, and creating records in two separate Cassandra tables for data organization and security.

**Why it exists**: User registration is the entry point for all authenticated features. By separating user profiles from credentials, we follow security best practices and optimize for different query patterns.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/users/register`
- **Auth Required**: No (public endpoint)
- **Success Status**: 201 Created

### Request Body

```json
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@example.com",
  "password": "SecureP@ssw0rd!"
}
```

### Response Body

```json
{
  "userid": "550e8400-e29b-41d4-a716-446655440000",
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@example.com"
}
```

## Cassandra Concepts Explained

### What is a Partition Key?

In Cassandra, the **partition key** determines which node in the cluster stores your data. It's the first part of the PRIMARY KEY definition. When you query by partition key, Cassandra can find your data instantly (O(1) lookup) because it knows exactly which node to check.

Think of it like this:
- **Partition Key = Street Address**: Tells you exactly which house (node) to go to
- **Without Partition Key = House Number Only**: You'd have to search every street in the city

### What is a Storage-Attached Index (SAI)?

Traditional databases use secondary indexes, but Cassandra 5.0 introduces **SAI (Storage-Attached Index)** which is much more powerful:

- **Old way**: Create a separate denormalized table for each query pattern
- **SAI way**: Create an index that allows flexible filtering without duplicate data

SAI indexes are efficient because they're built directly into Cassandra's storage engine, avoiding the performance penalties of older secondary indexes.

### Why Two Tables?

This endpoint writes to **two separate tables**:

1. **`users`** - Profile information (name, email, account status)
2. **`user_credentials`** - Authentication data (email, hashed password)

**Reasons for separation**:
- **Security**: Credentials are isolated from frequently-accessed profile data
- **Query Patterns**: Profile lookups by `userid`, credential lookups by `email`
- **Performance**: Smaller row size for profile queries (no password hash payload)
- **Compliance**: Easier to audit/encrypt/purge credential data separately

## Data Model

### Table: `users`

```cql
CREATE TABLE killrvideo.users (
    userid uuid PRIMARY KEY,        -- Partition key: unique identifier
    created_date timestamp,         -- Account creation timestamp
    email text,                     -- User's email address
    firstname text,                 -- First name
    lastname text,                  -- Last name
    account_status text,            -- 'active', 'suspended', etc.
    last_login_date timestamp       -- Last successful login
);

-- SAI index for email lookups
CREATE CUSTOM INDEX users_email_idx
ON killrvideo.users(email)
USING 'StorageAttachedIndex';

-- SAI index for filtering by account status
CREATE CUSTOM INDEX users_account_status_idx
ON killrvideo.users(account_status)
USING 'StorageAttachedIndex';
```

**Key Characteristics**:
- **Partition Key**: `userid` (UUID v4)
- **Indexes**: SAI on `email` and `account_status`
- **Data Type**: UUID for `userid` ensures global uniqueness

### Table: `user_credentials`

```cql
CREATE TABLE killrvideo.user_credentials (
    email text PRIMARY KEY,         -- Partition key: email address
    password text,                  -- Hashed password (bcrypt)
    userid uuid,                    -- Reference to users table
    account_locked boolean          -- Lock status for security
);
```

**Key Characteristics**:
- **Partition Key**: `email` (credentials are looked up by email during login)
- **No Index Needed**: Email is the partition key, so lookups are instant
- **Security**: Password is hashed using bcrypt before storage

## Database Queries

### 1. Check if Email Already Exists

```python
async def get_user_by_email_from_credentials_table(email: str):
    table = await get_table("user_credentials")
    return await table.find_one(filter={"email": email})
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.user_credentials WHERE email = 'john.doe@example.com';
```

**Performance**: **O(1)** - Direct partition key lookup, extremely fast

**Why this works**:
- `email` is the partition key in `user_credentials`
- Cassandra knows exactly which node has this data
- No table scan required

### 2. Insert New User Profile

```python
async def create_user_in_table(user_in: UserCreateRequest):
    users_table = await get_table("users")

    user_id = uuid4()  # Generate unique UUID
    creation_date = datetime.now(timezone.utc)

    user_document = {
        "userid": str(user_id),          # Converted to string for Data API
        "firstname": user_in.firstname,
        "lastname": user_in.lastname,
        "email": user_in.email,
        "created_date": creation_date.isoformat(),  # ISO-8601 format
        "account_status": "active",
        "last_login_date": None
    }

    await users_table.insert_one(document=user_document)
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.users (
    userid, firstname, lastname, email, created_date, account_status, last_login_date
) VALUES (
    550e8400-e29b-41d4-a716-446655440000,
    'John',
    'Doe',
    'john.doe@example.com',
    '2025-10-31T10:30:00Z',
    'active',
    null
);
```

**Performance**: **O(1)** - Single partition write

### 3. Insert Credentials Record

```python
hashed_password = get_password_hash(user_in.password)  # Bcrypt hash

credentials_document = {
    "email": user_in.email,
    "password": hashed_password,
    "userid": str(user_id),
    "account_locked": False
}

await credentials_table.insert_one(document=credentials_document)
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.user_credentials (
    email, password, userid, account_locked
) VALUES (
    'john.doe@example.com',
    '$2b$12$KIXvBxNYz8rN3qF.xJ7zPO...',  -- bcrypt hash
    550e8400-e29b-41d4-a716-446655440000,
    false
);
```

**Performance**: **O(1)** - Single partition write

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/users/register             │
│    {email, password, firstname, lastname}               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validate request body (Pydantic)                     │
│    └─ Calls user_service.get_user_by_email()            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Check for Existing Email                             │
│    Query: user_credentials WHERE email = ?              │
│    ├─ If found: Return 400 "Email already registered"   │
│    └─ If not found: Proceed to creation                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Generate User Data                                    │
│    ├─ userid = uuid4()                                  │
│    ├─ hashed_password = bcrypt(password)                │
│    └─ created_date = now()                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Write to TWO Tables (in parallel)                     │
│    ├─ INSERT INTO users (userid, firstname, ...)        │
│    └─ INSERT INTO user_credentials (email, password,...)│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 201 Created Response                           │
│    {userid, firstname, lastname, email}                 │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Data Serialization for Astra Data API

The Astra Data API requires primitive JSON types. UUIDs and datetimes must be converted:

```python
# Convert UUID → string
user_document["userid"] = str(user_id)

# Convert datetime → ISO-8601 string
user_document["created_date"] = creation_date.isoformat()
```

**Why**: The HTTP-based Data API uses JSON, which doesn't have native UUID or datetime types. The Astra backend converts these back to proper Cassandra types.

### 2. Password Security - Bcrypt

Passwords are hashed using **bcrypt** with automatic salt generation:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed_password = pwd_context.hash(password)
```

**Why bcrypt**:
- Computationally expensive (protects against brute force)
- Automatic salt generation (prevents rainbow table attacks)
- Configurable work factor (can increase as hardware improves)

### 3. UUID Generation - Version 4

User IDs use **UUID v4** (random):

```python
from uuid import uuid4
user_id = uuid4()
```

**Why UUID v4**:
- Globally unique without coordination
- Safe to generate client-side or server-side
- 128-bit space prevents collisions (2^128 possibilities)
- No time component (unlike v1), so no information leakage

### 4. Email Uniqueness Enforcement

**Problem**: Cassandra doesn't support traditional UNIQUE constraints like SQL databases.

**Solution**: Use `email` as the partition key in `user_credentials`:
- Attempting to insert duplicate email would require `IF NOT EXISTS` clause
- We check first with `find_one()`, then insert
- This creates a small race condition window

**Better Solution** (for production):
```python
# Lightweight transaction (LWT) - provides true uniqueness
await credentials_table.insert_one(
    document=credentials_document,
    if_not_exists=True  # Cassandra LWT
)
```

**Trade-off**: LWTs are slower but guarantee uniqueness even under concurrent requests.

### 5. No Transaction Across Tables

**Important**: Cassandra doesn't support multi-table transactions. The two INSERTs (users + credentials) are **not atomic**.

**What could go wrong**:
- `users` insert succeeds, but `credentials` insert fails
- Result: User profile exists, but can't log in

**Mitigation strategies**:
1. **Application-level cleanup**: Catch exceptions and delete user record
2. **Idempotent retry**: Design inserts to be safely retryable
3. **Background reconciliation**: Periodic job to find orphaned records
4. **Accept inconsistency**: With proper monitoring, this is rare enough to handle manually

### 6. SAI Index Benefits

Without SAI, looking up users by email would require:
- A separate `users_by_email` denormalized table
- Maintaining consistency across two user tables
- Double the storage cost

With SAI (`users_email_idx`):
- Single source of truth (`users` table)
- Index is maintained automatically
- Flexible querying without duplicate data

## Developer Tips

### Common Pitfalls

1. **Forgetting to hash passwords**: Always hash before storing. Never store plaintext.

2. **Using auto-increment IDs**: Cassandra has no auto-increment. Always use UUIDs or generated IDs.

3. **Expecting ACID transactions**: Cassandra is eventually consistent. Design for it.

4. **Not validating email format**: Use Pydantic's `EmailStr` type:
   ```python
   from pydantic import EmailStr
   email: EmailStr  # Automatic validation
   ```

5. **Partition key mistakes**: Choosing a bad partition key leads to:
   - **Hot partitions**: One node gets all traffic
   - **Large partitions**: Single partition > 100MB causes performance issues
   - **Rule of thumb**: Partition key should distribute data evenly

### Best Practices for Similar Use Cases

1. **Separate credentials from profiles**: Security and performance win

2. **Use SAI for secondary queries**: Replaces many denormalized tables

3. **UUID v4 for distributed IDs**: No coordination needed

4. **Hash passwords with bcrypt**: Industry standard, battle-tested

5. **Validate early with Pydantic**: Catch errors before database operations

6. **Return minimal data**: Don't return password hash or internal fields

7. **Use timestamps with timezone**: `datetime.now(timezone.utc)` not `datetime.now()`

8. **Consider LWTs for uniqueness**: When email uniqueness is critical

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Check email exists | **< 5ms** | Partition key lookup |
| Insert user | **< 10ms** | Single partition write |
| Insert credentials | **< 10ms** | Single partition write |
| Total registration | **< 30ms** | Two lookups + two inserts |

**Scalability**: This design scales horizontally. Add more Cassandra nodes for more capacity.

### Testing Tips

```python
# Example test for duplicate email
async def test_duplicate_email_registration():
    # Register user once
    response1 = await client.post("/api/v1/users/register", json={
        "email": "test@example.com",
        "password": "Test1234!",
        "firstname": "Test",
        "lastname": "User"
    })
    assert response1.status_code == 201

    # Try to register same email again
    response2 = await client.post("/api/v1/users/register", json={
        "email": "test@example.com",  # Same email
        "password": "Different1234!",
        "firstname": "Another",
        "lastname": "User"
    })
    assert response2.status_code == 400
    assert "already registered" in response2.json()["detail"]
```

## Related Endpoints

- [POST /api/v1/users/login](/services/account-management/post-login/) - Authenticate with these credentials
- [GET /api/v1/users/me](/services/account-management/get-me/) - Retrieve profile after login
- [GET /api/v1/users/{user_id}](/services/account-management/get-user-by-id/) - Public profile lookup

## Further Learning

- [Cassandra Partition Keys](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/data-modeling-rdbms.html)
- [Storage-Attached Indexes (SAI)](https://docs.datastax.com/en/storage-attached-index/latest/)
- [UUID Best Practices](https://www.datastax.com/blog/uuid-vs-timeuuid)
- [Bcrypt Password Hashing](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)
