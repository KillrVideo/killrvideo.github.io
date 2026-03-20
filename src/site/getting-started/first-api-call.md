---
title: Your First API Call
order: 3
description: Register a user and make an authenticated request
---

# Your First API Call

With the server running at `http://localhost:8000`, let's walk through the core authentication flow: register, login, and make an authenticated request.

## Step 1: Register a User

Create a new account by sending a POST request to the registration endpoint:

```bash
curl -s -X POST http://localhost:8000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "SecurePass123!",
    "firstName": "Dev",
    "lastName": "User"
  }' | jq .
```

A successful response returns the created user record:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "dev@example.com",
  "firstName": "Dev",
  "lastName": "User",
  "roles": ["viewer"],
  "createdAt": "2025-03-19T12:00:00Z"
}
```

Note the `userId` — it is a UUID generated automatically by the backend. All resources in KillrVideo use UUID identifiers.

## Step 2: Login and Get a Token

Now log in with the credentials you just registered:

```bash
curl -s -X POST http://localhost:8000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "SecurePass123!"
  }' | jq .
```

The response includes a JWT access token:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlcyI6WyJ2aWV3ZXIiXSwiZXhwIjoxNzEyMDAwMDAwfQ.signature",
  "tokenType": "bearer"
}
```

Copy the value of `accessToken`. You will need it for authenticated requests.

## Step 3: View Your Profile

Use the token to fetch your own user profile:

```bash
# Store the token in a variable for convenience
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -s http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

The response returns your profile:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "dev@example.com",
  "firstName": "Dev",
  "lastName": "User",
  "roles": ["viewer"],
  "createdAt": "2025-03-19T12:00:00Z"
}
```

If you omit the Authorization header or provide an invalid token, you get a 401 response:

```json
{
  "status": 401,
  "type": "https://killrvideo.github.io/errors/unauthorized",
  "title": "Unauthorized",
  "detail": "Could not validate credentials."
}
```

## Step 4: Browse Public Endpoints

Not all endpoints require authentication. The latest videos feed is public:

```bash
curl -s "http://localhost:8000/api/v1/videos/latest?page=1&pageSize=5" | jq .
```

The response uses the standard pagination wrapper:

```json
{
  "data": [],
  "pagination": {
    "currentPage": 1,
    "pageSize": 5,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

The `data` array is empty because you haven't submitted any videos yet. That is expected — the database is freshly initialized.

## Exploring Further

The Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs) documents every endpoint interactively. You can authorize with your token there using the **Authorize** button and try any endpoint without writing curl commands.

From here, you can:

- Submit a video: `POST /api/v1/videos`
- Search by keyword: `GET /api/v1/search?q=your+query`
- Post a comment: `POST /api/v1/videos/{video_id}/comments`

Each of these exercises a different data pattern in Astra DB. The [Concepts](/concepts/data-modeling/) section explains the data modeling decisions behind them.
