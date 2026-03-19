---
title: Authentication & Authorization
order: 2
description: JWT authentication and role-based access control
---

# Authentication & Authorization

KillrVideo uses JSON Web Tokens (JWTs) for authentication and role-based access control (RBAC) for authorization. This is a stateless approach — the server does not store sessions, and every request is authenticated independently by validating the token.

## JWT Overview

A JSON Web Token is a compact, self-contained token that encodes user identity and claims. It is signed by the server using a secret key, so the server can verify that any token it receives was genuinely issued by itself — without looking anything up in a database.

KillrVideo signs tokens with HMAC-SHA256 (`HS256`). The signing secret is stored in the `JWT_SECRET_KEY` environment variable. Any request with a valid signature and a non-expired token is accepted.

## Token Structure

A JWT has three parts separated by dots: `header.payload.signature`

The **header** identifies the token type and signing algorithm:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

The **payload** carries the user's identity and roles:

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "roles": ["viewer", "creator"],
  "exp": 1742400000,
  "iat": 1742396400
}
```

- `sub` (subject): the user's UUID
- `roles`: list of role strings assigned to this user
- `exp`: expiry timestamp (Unix epoch)
- `iat`: issued-at timestamp

The **signature** is the HMAC-SHA256 hash of the encoded header and payload, computed with the server's secret key. Clients cannot forge or modify a token without the secret.

The payload is Base64-encoded, not encrypted. Do not put sensitive data in JWT claims — anyone can decode the payload. The signature ensures integrity, not confidentiality.

## RBAC Roles

KillrVideo defines three roles:

**viewer** — assigned to every new user at registration. A viewer can:
- Browse video listings and feeds
- View video details, comments, and ratings
- Use keyword and semantic search
- View their own profile

**creator** — a viewer with upload capabilities. A creator can do everything a viewer can, plus:
- Submit new videos
- Update and delete their own videos
- Manage their video catalog

**moderator** — a restricted administrative role. A moderator can:
- View content flagged for review
- Approve or reject flagged content
- Access moderation queues

Roles are stored in the `roles` column of the `users` table as a `set<text>`. A user can hold multiple roles simultaneously — a creator who is also a moderator would have `["viewer", "creator", "moderator"]` in their token.

## Authentication Flow

The sequence for a protected request:

1. Client sends credentials to `POST /api/v1/users/login`
2. Server verifies the password against the bcrypt hash stored in Astra DB
3. Server issues a JWT containing the user's ID and current roles
4. Client stores the token and includes it in subsequent requests: `Authorization: Bearer <token>`
5. For each protected request, a FastAPI dependency decodes and validates the token
6. If the token is valid and the user has the required role, the handler runs
7. If not, the dependency raises an HTTP 401 or 403 before the handler is called

## Role Checking with FastAPI Dependencies

FastAPI's dependency injection system makes role enforcement clean and composable. Each protected route declares which dependency it needs:

```python
# Requires any authenticated user (viewer role minimum)
@router.get("/videos/{video_id}")
async def get_video(
    video_id: UUID,
    current_user: User = Depends(get_current_viewer)
):
    ...

# Requires creator role
@router.post("/videos")
async def submit_video(
    video: VideoCreate,
    current_user: User = Depends(get_current_creator)
):
    ...

# Requires moderator role
@router.get("/moderation/queue")
async def get_moderation_queue(
    current_user: User = Depends(get_current_moderator)
):
    ...
```

The `get_current_viewer`, `get_current_creator`, and `get_current_moderator` dependencies each decode the JWT from the Authorization header, validate the signature, check the expiry, verify the required role, and return the user object — or raise an appropriate HTTP error.

## Security Practices

**bcrypt for passwords**: Passwords are never stored in plaintext. The `passlib[bcrypt]` library hashes passwords with bcrypt (work factor 12) before storage. The hash is verified at login using `bcrypt.verify`.

**Short-lived tokens**: Tokens expire after 60 minutes by default (configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`). Clients must re-authenticate after expiry.

**HTTPS in production**: JWTs are bearer tokens — anyone who obtains a token can use it. Always use HTTPS in production to prevent token interception. For local development, HTTP is fine.

**No token storage in the database**: The server does not store issued tokens. Token revocation (e.g., on logout or password change) requires either short expiry times or a token blocklist, depending on your security requirements.
