---
title: "POST /api/v1/users/login"
description: "Authenticate and receive a JWT token"
endpoint: "/api/v1/users/login"
method: "POST"
spec_artifact: "/services/account-management/_specs/post-login.spec.md"
concepts:
  - partition-keys
  - jwt-authentication
  - bcrypt-verification
  - multi-table-lookup
  - rbac
order: 3
---

# POST /api/v1/users/login - User Authentication

## Overview

This endpoint authenticates users and returns a JWT (JSON Web Token) for accessing protected resources. It validates credentials, updates login tracking, and issues a time-limited token containing user identity and roles.

**Why it exists**: Stateless authentication allows the API to scale horizontally without session storage. JWTs carry auth context, eliminating the need for session lookups on every request.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/users/login`
- **Auth Required**: No (public endpoint, but requires valid credentials)
- **Success Status**: 200 OK

### Request Body

```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ssw0rd!"
}
```

### Response Body

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "account_status": "active",
    "created_date": "2025-10-31T10:30:00Z",
    "last_login_date": "2025-10-31T14:22:15Z"
  }
}
```

## Cassandra Concepts Explained

### Multi-Table Lookup Pattern

This endpoint demonstrates a common Cassandra pattern: **lookup by one key, then fetch by another**:

1. **First lookup**: `user_credentials` table (partition key: `email`)
2. **Second lookup**: `users` table (partition key: `userid`)

**Why split into two queries?**
- Each table is optimized for different access patterns
- Credentials lookups happen by email (users type email to log in)
- Profile lookups happen by userid (JWT contains userid)
- Two fast O(1) lookups are better than one slow table scan

### The UPDATE Operation

The login process updates the `last_login_date` field in the `users` table:

```python
await users_table.update_one(
    filter={"userid": user_credentials["userid"]},
    update={"$set": {"last_login_date": datetime.now(timezone.utc)}}
)
```

**Cassandra UPDATE behavior**:
- UPDATE and INSERT are the same operation (called an "upsert")
- If the row exists, it updates the specified columns
- If the row doesn't exist, it creates a new row with those columns
- No "row locking" - last write wins (timestamp-based conflict resolution)

### What is $set?

The `$set` operator comes from the Astra Data API (which uses MongoDB-like syntax):

```python
{"$set": {"last_login_date": "2025-10-31T14:22:15Z"}}
```

**Translation to CQL**:
```cql
UPDATE killrvideo.users
SET last_login_date = '2025-10-31T14:22:15Z'
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Why $set exists**: The Data API is HTTP/JSON based, so it needs a way to express operations like SET, INCREMENT, etc. in JSON format.

## Data Model

### Table: `user_credentials`

```cql
CREATE TABLE killrvideo.user_credentials (
    email text PRIMARY KEY,
    password text,              -- Bcrypt hash
    userid uuid,                -- FK to users table
    account_locked boolean
);
```

**Purpose**: Fast credential lookups by email during login

### Table: `users`

```cql
CREATE TABLE killrvideo.users (
    userid uuid PRIMARY KEY,
    created_date timestamp,
    email text,
    firstname text,
    lastname text,
    account_status text,        -- 'viewer', 'creator', 'moderator'
    last_login_date timestamp
);
```

**Purpose**: Complete user profile information

## Database Queries

### 1. Lookup Credentials by Email

```python
async def authenticate_user_from_table(email: str, password: str):
    credentials_table = await get_table("user_credentials")
    user_credentials = await credentials_table.find_one(filter={"email": email})
```

**Equivalent CQL**:
```cql
SELECT email, password, userid, account_locked
FROM killrvideo.user_credentials
WHERE email = 'john.doe@example.com';
```

**Performance**: **O(1)** - Email is the partition key

### 2. Verify Password Hash

```python
if not verify_password(password, user_credentials["password"]):
    return None  # Invalid password
```

**How bcrypt verification works**:
1. Extract salt from stored hash
2. Hash the provided password with same salt
3. Compare hashes in constant time (prevents timing attacks)

**Performance**: **~100-300ms** - Intentionally slow (bcrypt cost factor = 12)

**Why slow?** Defense against brute force attacks. Each login attempt takes 100-300ms, making password guessing impractical.

### 3. Check Account Lock Status

```python
if user_credentials.get("account_locked"):
    return None  # Account is locked
```

**Purpose**: Prevent login after too many failed attempts (admin can lock accounts)

### 4. Fetch User Profile by ID

```python
users_table = await get_table("users")
user_data_dict = await users_table.find_one(
    filter={"userid": user_credentials["userid"]}
)
```

**Equivalent CQL**:
```cql
SELECT *
FROM killrvideo.users
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: **O(1)** - `userid` is the partition key

### 5. Update Last Login Timestamp

```python
await users_table.update_one(
    filter={"userid": user_credentials["userid"]},
    update={"$set": {"last_login_date": datetime.now(timezone.utc)}}
)
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.users
SET last_login_date = '2025-10-31T14:22:15Z'
WHERE userid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: **O(1)** - Single partition update

**Note**: This update happens **after** password verification succeeds.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/users/login                 │
│    {email: "user@example.com", password: "secret"}       │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Query user_credentials by email                       │
│    SELECT * WHERE email = ?                              │
│    ├─ Not found? → 401 "Incorrect email or password"     │
│    └─ Found? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Verify password with bcrypt (100-300ms)               │
│    verify_password(plain, hashed)                        │
│    ├─ Mismatch? → 401 "Incorrect email or password"      │
│    └─ Match? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Check account_locked flag                             │
│    ├─ Locked? → 401                                      │
│    └─ Not locked? → Continue                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Fetch full user profile from users table              │
│    SELECT * WHERE userid = credentials.userid            │
│    ├─ Not found? → 401 (data inconsistency)              │
│    └─ Found? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Update last_login_date                                │
│    UPDATE users SET last_login_date = NOW()              │
│    WHERE userid = ?                                      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 7. Generate JWT token                                    │
│    Payload: {sub: userid, roles: [account_status]}      │
│    Expiration: 24 hours                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 8. Return 200 OK with token + user object                │
│    {token: "eyJ...", user: {...}}                        │
└──────────────────────────────────────────────────────────┘
```

**Total Queries**: 3 (1 SELECT from credentials, 1 SELECT from users, 1 UPDATE)

**Expected Latency**: 120-350ms (mostly bcrypt hashing time)

## Special Notes

### 1. JWT Token Structure

```python
from datetime import timedelta
from jose import jwt

def create_access_token(subject: UUID, roles: List[str]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)

    payload = {
        "sub": str(subject),      # User ID (subject)
        "roles": roles,           # ["viewer"] or ["creator"] or ["moderator"]
        "exp": expire             # Expiration timestamp
    }

    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

**Decoded Token**:
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "roles": ["viewer"],
  "exp": 1730383335
}
```

**Security Notes**:
- Token is **signed** with HMAC-SHA256 (prevents tampering)
- Token is **not encrypted** (payload is base64, readable by anyone)
- Never put secrets in JWTs (they're visible to clients)
- Expiration (exp) is enforced by JWT library

### 2. Role-Based Access Control (RBAC)

The `account_status` field doubles as the user's role:

```python
access_token = create_access_token(
    subject=authenticated_user.userid,
    roles=[authenticated_user.account_status]  # "viewer", "creator", or "moderator"
)
```

**Role Hierarchy**:
- **viewer**: Can view content, comment, rate (default for new users)
- **creator**: Can upload videos + viewer permissions
- **moderator**: Can review flags, manage users + all permissions

### 3. Intentionally Vague Error Messages

Notice the error message is always the same:

```python
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password"
)
```

**Why not be specific?**
- Don't reveal if email exists ("User not found" leaks info)
- Don't reveal if password is wrong ("Invalid password" leaks info)
- Prevents username enumeration attacks

**Security Trade-off**: Slightly worse UX for better security

### 4. The Missing Login Attempt Counter

The schema includes a `login_attempts` table:

```cql
CREATE TABLE killrvideo.login_attempts (
    email text PRIMARY KEY,
    failed_attempts counter
);
```

**Counter columns** in Cassandra are special:
- Can only be incremented/decremented
- Cannot be set to arbitrary values
- Must be in a separate table (counters can't mix with regular columns)

Planned behavior would increment the counter on failure and lock the account after 5 failed attempts.

### 5. Last Login Timestamp Update

The update happens **fire-and-forget style**:

```python
await users_table.update_one(...)  # Update last_login_date
return User.model_validate(user_data_dict)  # Returns OLD data
```

**Result**: The returned user object has the **old** `last_login_date`, not the newly set value.

**Fix** (if needed):
```python
await users_table.update_one(...)
updated_user = await users_table.find_one(filter={"userid": userid})
return User.model_validate(updated_user)  # Returns NEW data
```

**Trade-off**: One extra query for fresher data

## Developer Tips

### Common Pitfalls

1. **Timing attacks in password comparison**: Use constant-time comparison
   ```python
   # BAD: Can be timed to reveal password length
   if plain_password == stored_password:
       ...

   # GOOD: Constant time (bcrypt does this internally)
   if verify_password(plain_password, stored_hash):
       ...
   ```

2. **Leaking user existence**: Don't reveal if email exists in errors

3. **Storing JWT server-side**: JWTs are meant to be stateless. Don't store them.

4. **Long-lived tokens**: 24 hours is reasonable. Months/years is dangerous.

5. **Not checking account_locked**: Always check before issuing tokens

### Best Practices

1. **Always use HTTPS**: JWTs in HTTP headers are visible in transit

2. **Implement rate limiting**: Prevent brute force at the API gateway level

3. **Log failed attempts**: Monitor for credential stuffing attacks

4. **Implement account lockout**: After N failed attempts, lock for X minutes

5. **Use refresh tokens**: Short-lived access tokens + long-lived refresh tokens

### Performance Optimization

**Current**: 3 sequential database queries
```
credentials lookup (10ms)
  → bcrypt verify (200ms)
    → user profile lookup (10ms)
      → last_login update (10ms)
```

**Optimization**: Parallelize the profile lookup and update:
```python
import asyncio

user_task = users_table.find_one(filter={"userid": userid})
update_task = users_table.update_one(
    filter={"userid": userid},
    update={"$set": {"last_login_date": datetime.now(timezone.utc)}}
)

user_data_dict, _ = await asyncio.gather(user_task, update_task)
```

**Savings**: ~10ms (small but every bit counts under load)

### Testing Tips

```python
# Test successful login
async def test_successful_login():
    response = await client.post("/api/v1/users/login", json={
        "email": "test@example.com",
        "password": "ValidPass123!"
    })

    assert response.status_code == 200
    data = response.json()

    # Verify token structure
    assert "token" in data
    assert "user" in data

    # Decode and verify JWT
    from jose import jwt
    payload = jwt.decode(data["token"], SECRET_KEY, algorithms=["HS256"])
    assert payload["sub"] == data["user"]["userId"]
    assert "viewer" in payload["roles"]

# Test invalid credentials
async def test_invalid_password():
    response = await client.post("/api/v1/users/login", json={
        "email": "test@example.com",
        "password": "WrongPassword123!"
    })

    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]
    # Should NOT reveal if email exists or password is wrong
```

## Related Endpoints

- [POST /api/v1/users/register](/services/account-management/post-register/) - Create account first
- [GET /api/v1/users/me](/services/account-management/get-me/) - Use JWT token to fetch profile
- [PUT /api/v1/users/me](/services/account-management/put-me/) - Use JWT token to update profile

## Further Learning

- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Bcrypt vs Argon2 vs Scrypt](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Authentication Guide](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Cassandra Counter Columns](https://cassandra.apache.org/doc/latest/cassandra/cql/data-model.html#counters)
