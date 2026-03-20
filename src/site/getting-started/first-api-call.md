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

## Step 4: Submit a Video

Now let's create something. Submit a YouTube video URL — this is a **creator** action that writes to the database and kicks off background processing:

```bash
curl -s -X POST http://localhost:8000/api/v1/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "My First KillrVideo Upload"
  }' | jq .
```

The response returns **202 Accepted** — the video is queued for processing:

```json
{
  "videoId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "My First KillrVideo Upload",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "submittedAt": "2025-03-19T12:05:00Z",
  "location": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "tags": [],
  "views": 0
}
```

Save the `videoId` — you'll need it next.

## Step 5: Check Processing Status

The video goes through `PENDING` → `PROCESSING` → `READY`. Poll the status endpoint to watch the transition:

```bash
VIDEO_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

curl -s http://localhost:8000/api/v1/videos/id/$VIDEO_ID/status \
  -H "Authorization: Bearer $TOKEN" | jq .
```

```json
{
  "videoId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "READY"
}
```

Once the status is `READY`, the video is visible in all public feeds.

## Step 6: See the Round Trip

Now browse the latest videos feed — your video should appear:

```bash
curl -s "http://localhost:8000/api/v1/videos/latest?page=1&pageSize=5" | jq .
```

```json
{
  "data": [
    {
      "videoId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "My First KillrVideo Upload",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "submittedAt": "2025-03-19T12:05:00Z",
      "views": 0
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 5,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

That's the full round trip: **register → login → create a resource → read it back**.

## Step 7: Interact with the Video

Now try the remaining write operations against your video:

**Record a view:**
```bash
curl -s -X POST http://localhost:8000/api/v1/videos/id/$VIDEO_ID/view \
  -H "Authorization: Bearer $TOKEN" -w "\nHTTP Status: %{http_code}\n"
```
Returns `204 No Content` — the view counter incremented.

**Rate it:**
```bash
curl -s -X POST http://localhost:8000/api/v1/videos/id/$VIDEO_ID/rating \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"rating": 5}'
```

**Post a comment:**
```bash
curl -s -X POST http://localhost:8000/api/v1/videos/$VIDEO_ID/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "Great video!"}' | jq .
```

**Read it all back** — fetch the full video detail to see views, ratings, and everything together:
```bash
curl -s http://localhost:8000/api/v1/videos/id/$VIDEO_ID | jq .
```

Each of these operations exercises a different Cassandra data pattern — counter increments, upserts, denormalized writes. The [Services](/services/) section has detailed explainers for every endpoint.

## Exploring Further

The Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs) documents every endpoint interactively. You can authorize with your token using the **Authorize** button and try any endpoint without writing curl commands.

The [Concepts](/concepts/data-modeling/) section explains the data modeling decisions behind each pattern you just used.
