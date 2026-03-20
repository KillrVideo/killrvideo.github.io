---
title: How Services Connect
order: 3
description: Service interaction patterns in KillrVideo
---

# How Services Connect

KillrVideo 2025 is a monolith: one FastAPI process hosting all six service domains. The services do not call each other over the network — they are code modules within the same application. But the boundaries between them are real and enforced by convention.

## REST API Conventions

All API routes are prefixed with `/api/v1`. Every request and response uses `application/json`. There is no XML, no form encoding, no custom content types.

Route structure follows REST conventions:

```
GET    /api/v1/videos/latest          # list resources
GET    /api/v1/videos/{video_id}      # get one resource
POST   /api/v1/videos                 # create a resource
PUT    /api/v1/videos/{video_id}      # replace a resource
PATCH  /api/v1/videos/{video_id}      # partial update
DELETE /api/v1/videos/{video_id}      # delete a resource
```

Resource identifiers are UUIDs passed as path parameters. There are no auto-increment integer IDs.

## Service Boundaries

Each domain owns its tables. The Account Management domain owns the `users` table. The Video Catalog domain owns the `videos` table. No domain reads or writes another domain's tables directly.

When one domain needs data from another — for example, when the Recommendations domain needs to look up a user's watch history — it calls the other domain's service layer (Python function), not its database table. This keeps the data model for each domain encapsulated.

## Authentication Flow

The authentication sequence is:

1. **Register**: `POST /api/v1/users/register` with email, password, and display name. Returns the created user record.
2. **Login**: `POST /api/v1/users/login` with email and password. Returns a JWT access token.
3. **Authenticate requests**: Include the token in the `Authorization` header as `Bearer <token>`.
4. **Token validation**: FastAPI dependencies decode the token on each request, verify the signature, check expiry, and extract the user ID and roles.

Tokens do not require server-side storage. The server validates the signature using the shared secret and trusts the claims in the payload.

## Pagination

List endpoints return a consistent pagination wrapper:

```json
{
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 47,
    "totalPages": 5
  }
}
```

Clients request pages with query parameters: `?page=1&pageSize=10`. The default page size is 10. The maximum page size is 50.

## Error Responses

Errors follow the RFC 7807 Problem+JSON format. Every error response has a consistent structure:

```json
{
  "status": 404,
  "type": "https://killrvideo.github.io/errors/not-found",
  "title": "Not Found",
  "detail": "Video with id '550e8400-e29b-41d4-a716-446655440000' was not found."
}
```

The `status` field matches the HTTP status code. The `type` field is a URI that identifies the error class. The `detail` field is a human-readable message safe to display to users.

Status codes in use:

| Code | Meaning |
|---|---|
| 200 | OK — request succeeded |
| 201 | Created — resource was created |
| 204 | No Content — request succeeded, no body |
| 400 | Bad Request — malformed request |
| 401 | Unauthorized — no valid token |
| 403 | Forbidden — valid token but insufficient role |
| 404 | Not Found — resource does not exist |
| 422 | Unprocessable Entity — validation failed |

## A Full Data Flow Example

To see how the services interact in practice, trace the path of a new video submission:

1. User calls `POST /api/v1/users/register` and receives their user record.
2. User calls `POST /api/v1/users/login` and receives a JWT token.
3. User calls `POST /api/v1/videos` with the JWT in the Authorization header and the video metadata in the request body.
4. The video domain validates the token (via FastAPI dependency), extracts the user ID, and writes the video record to the `videos` table in Astra DB.
5. The backend calls the embedding service to generate a vector from the video title and description, then updates the video record with the embedding vector.
6. The video now appears in `GET /api/v1/videos/latest` (the chronological feed) and in vector search results.

Each step involves exactly one service domain and one Astra DB operation. No messages queues, no async workers, no eventual consistency between services. The whole flow is synchronous within a single HTTP request.
