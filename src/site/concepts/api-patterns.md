---
title: API Patterns
order: 3
description: REST conventions, pagination, and error handling
---

# API Patterns

KillrVideo uses consistent patterns across all endpoints. Understanding these conventions will help you read the API quickly and know what to expect from any endpoint you encounter.

## Base URL

All API routes are prefixed with `/api/v1`:

```
http://localhost:8000/api/v1/...
```

The `v1` version prefix allows the API to evolve without breaking existing clients. All current endpoints are under `v1`.

## JSON Everywhere

Every request body and response body uses `application/json`. Set the `Content-Type: application/json` header on requests that include a body (POST, PUT, PATCH). Responses always include `Content-Type: application/json`.

There is no XML, no form-encoded bodies, no multipart (video files are referenced by URL, not uploaded directly).

## Resource Identifiers

All resources are identified by UUIDs, not integer IDs. UUIDs appear as path parameters:

```
GET /api/v1/videos/550e8400-e29b-41d4-a716-446655440000
GET /api/v1/users/a8098c1a-f86e-11da-bd1a-00112444be1e
```

UUIDs are lowercase with hyphens in the standard 8-4-4-4-12 format.

## Pagination

All list endpoints return paginated results using a consistent wrapper structure:

```json
{
  "data": [
    { ... },
    { ... }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 47,
    "totalPages": 5
  }
}
```

Request specific pages with query parameters:

```
GET /api/v1/videos/latest?page=2&pageSize=20
```

| Parameter | Default | Maximum | Description |
|---|---|---|---|
| `page` | 1 | — | Page number (1-indexed) |
| `pageSize` | 10 | 50 | Items per page |

When `totalItems` is 0, `data` is an empty array and `totalPages` is 0.

## Error Responses

Errors follow [RFC 7807 Problem+JSON](https://www.rfc-editor.org/rfc/rfc7807). Every error response has the same shape:

```json
{
  "status": 404,
  "type": "https://killrvideo.github.io/errors/not-found",
  "title": "Not Found",
  "detail": "Video with id '550e8400-e29b-41d4-a716-446655440000' was not found."
}
```

- `status` — matches the HTTP status code
- `type` — a URI that identifies the error class (can be used to handle specific errors programmatically)
- `title` — short, human-readable error name
- `detail` — longer message safe to display to users

## HTTP Status Codes

| Code | When it's used |
|---|---|
| `200 OK` | Successful GET, PUT, or PATCH |
| `201 Created` | Successful POST that created a resource |
| `204 No Content` | Successful DELETE (no body) |
| `400 Bad Request` | Request is malformed (missing required fields, wrong types) |
| `401 Unauthorized` | No token provided or token is invalid/expired |
| `403 Forbidden` | Valid token but insufficient role for this endpoint |
| `404 Not Found` | Resource does not exist |
| `422 Unprocessable Entity` | Pydantic validation failed (returned by FastAPI automatically) |

422 responses come from FastAPI's built-in validation and have a different shape than other errors — they include a `detail` array listing each field validation failure.

## Authentication Header

Protected endpoints require a Bearer token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Omitting the header on a protected endpoint returns 401. Providing a valid token with insufficient role returns 403.

Public endpoints (video feeds, search, individual video detail) do not require authentication and return the same response whether or not a token is provided.
