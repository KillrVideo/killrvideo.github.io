---
title: "PUT /api/v1/videos/id/{video_id}"
description: "Update video metadata including title, description, and tags with authorization checks"
endpoint: "/api/v1/videos/id/{video_id}"
method: "PUT"
spec_artifact: "/services/video-catalog/_specs/put-video.spec.md"
concepts:
  - partial-updates-with-set
  - authorization-owner-moderator
  - optimistic-updates
  - set-type-replacement
order: 7
draft: true
---

# PUT /api/v1/videos/id/{video_id} - Update Video Metadata

## Overview

This endpoint allows a video owner (or platform moderator) to update a video's title, description, and tags. It demonstrates **partial updates** in Cassandra using `$set` semantics — only the fields included in the request are changed; others remain untouched.

**Why it exists**: Creators need to fix typos, add descriptions, and refine tags after upload. Moderators need to correct problematic content without deleting videos entirely.

## HTTP Details

- **Method**: PUT
- **Path**: `/api/v1/videos/id/{video_id}`
- **Auth Required**: Yes — must be the video owner OR have moderator role
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to update |

### Request Body

All fields are optional. Include only the fields you want to change.

```json
{
  "title": "Updated: Introduction to Apache Cassandra 5.0",
  "description": "A comprehensive guide to Cassandra 5.0 features including SAI, vector search, and more.",
  "tags": ["cassandra", "cassandra5", "nosql", "databases"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | New video title |
| `description` | string | No | New video description |
| `tags` | array of string | No | Replaces the entire tag set |

### Response Body (200 OK)

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Updated: Introduction to Apache Cassandra 5.0",
  "description": "A comprehensive guide to Cassandra 5.0 features...",
  "location": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "tags": ["cassandra", "cassandra5", "nosql", "databases"],
  "previewImageLocation": "https://img.youtube.com/vi/.../mqdefault.jpg",
  "addedDate": "2025-10-31T10:30:00Z",
  "views": 1042,
  "status": "READY"
}
```

## Cassandra Concepts Explained

### Partial Updates with `$set`

In Cassandra (and the Data API), updating a row does not require you to provide all columns. You can update exactly the columns you want to change. This is the default behavior — Cassandra stores columns independently within a row.

```cql
-- Only update name and description; tags and other columns are untouched
UPDATE killrvideo.videos
SET name = 'Updated Title',
    description = 'New description'
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

In the Data API, this is expressed with `$set`:
```json
{
  "$set": {
    "name": "Updated Title",
    "description": "New description"
  }
}
```

**Why this is important**: Unlike an SQL UPDATE, Cassandra does not touch columns that are omitted. Each column has its own cell with its own timestamp. Updating `name` does not affect `description` at all — they are independent writes.

### Replacing a `set<text>` Collection

For the `tags` column (type `set<text>`), providing a new tag array in the request **replaces the entire set**. Cassandra handles this as a tombstone + new write under the hood.

```cql
-- Replace all tags
UPDATE killrvideo.videos
SET tags = {'cassandra', 'cassandra5', 'nosql'}
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;

-- Alternatively, add specific tags
UPDATE killrvideo.videos
SET tags = tags + {'cassandra5'}
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;

-- Remove a specific tag
UPDATE killrvideo.videos
SET tags = tags - {'old-tag'}
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

The API endpoint uses full replacement (you specify the complete desired tag set).

### Authorization: Owner or Moderator

This endpoint enforces authorization at the application layer:

1. **Owner check**: Does the authenticated user's `userId` match the video's `userid`?
2. **Moderator check**: Does the authenticated user have the `moderator` role in their JWT claims?

Either condition allows the update. This is a common **RBAC (Role-Based Access Control)** pattern:
```
Allow if: user.id == video.userid  OR  user.role == 'moderator'
```

Cassandra itself has no concept of row-level authorization — this logic lives entirely in the application.

## Data Model

### Table: `videos` (relevant columns for update)

```cql
CREATE TABLE killrvideo.videos (
    videoid uuid PRIMARY KEY,
    userid  uuid,      -- Owner check: must match authenticated user
    name    text,      -- Updateable
    description text,  -- Updateable
    tags    set<text>, -- Updateable (full replacement)
    -- ... other columns unchanged by this endpoint
);
```

## Database Queries

### 1. Read Video to Check Ownership

Before updating, the service fetches the video to verify the requester is the owner (unless they're a moderator):

**Equivalent CQL**:
```cql
SELECT videoid, userid, name, description, tags, status
FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

### 2. Apply Partial Update

**Equivalent CQL** (updating only changed fields):
```cql
UPDATE killrvideo.videos
SET name = 'Updated: Introduction to Apache Cassandra 5.0',
    description = 'A comprehensive guide to Cassandra 5.0...',
    tags = {'cassandra', 'cassandra5', 'nosql', 'databases'}
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

### 3. Read Updated Video (for response)

After the update, the service re-fetches the full row to return the current state:
```cql
SELECT * FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends PUT /api/v1/videos/id/{video_id}         │
│    with JWT and request body                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Authenticate: extract userId and role from JWT        │
│    └─ Missing/invalid JWT? → 401 Unauthorized            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Validate request body (all fields optional)           │
│    └─ Invalid types? → 422 Validation Error              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Fetch video by videoid                                │
│    ├─ Not found? → 404 Video not found                   │
│    └─ Found? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Authorization check                                   │
│    ├─ user.id == video.userid? → authorized              │
│    ├─ user.role == 'moderator'? → authorized             │
│    └─ Neither? → 403 Forbidden                           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Build $set update from non-null request fields        │
│    UPDATE videos SET name=?, description=?, tags=?       │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 7. Re-fetch video for response                           │
│    SELECT * FROM videos WHERE videoid = ?                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 8. Return 200 OK with VideoDetailResponse                │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 SELECT (ownership check) + 1 UPDATE + 1 SELECT (response)
**Expected latency**: 15–30ms

## Special Notes

### 1. Read-Modify-Write Is Not Atomic

The ownership check (SELECT) and the update (UPDATE) are two separate operations. In theory, another request could change the video between these two operations. For typical metadata updates, this race condition is inconsequential.

If strict consistency were required, a Cassandra Lightweight Transaction (LWT) could enforce it:
```cql
UPDATE killrvideo.videos
SET name = 'New Title'
WHERE videoid = ?
IF userid = ?;  -- Only update if userid matches
```

LWTs add latency but provide atomic check-and-set.

### 2. The `location` Field Is Not Updateable

The YouTube URL (`location`) is intentionally excluded from this endpoint. Changing the URL would make the video a fundamentally different piece of content. If a creator wants to update to a different video, they should submit a new one.

### 3. Tag Set Semantics

When you send `"tags": ["cassandra", "databases"]`, you are **replacing** the entire set, not appending. If the video previously had tags `["cassandra", "nosql", "old-tag"]`, after the update the tags will be exactly `["cassandra", "databases"]`.

If you want to add a single tag without removing others, you'd need to first GET the current tags, merge them in client code, and then PUT the merged set.

### 4. Cascading Updates

The `name` and `tags` columns exist in the `videos` table (source of truth). However, the `latest_videos` table also stores `name` for display in the home feed. Updating a video's title does **not** automatically update `latest_videos` in the current implementation — the home feed may show stale titles until the next cache refresh.

## Developer Tips

### Common Pitfalls

1. **Forgetting to include unchanged tags**: If you only want to add one tag, you must include all existing tags plus the new one. Sending just the new tag removes all others.

2. **Assuming PUT replaces the whole record**: This endpoint performs a partial update — only the fields you send are changed. Omitting `description` does not clear it.

3. **Not re-fetching after update**: The response includes the latest state. Don't use the request body as the "new state" — the response is authoritative.

4. **Authorization bypass via UUID guessing**: UUIDs are not secret. Authorization checks are essential.

### Best Practices

1. **Normalize tags on update too**: Apply the same lowercase/trim normalization used during video creation.

2. **Return the full updated document**: Clients should update their local state from the response, not from the request body.

3. **Audit log moderator changes**: When a moderator (not the owner) changes a video's metadata, log the action with who changed what and when.

4. **Validate tag count and length**: Same constraints as on creation — max 10 tags, max 32 chars each.

### Performance Expectations

| Operation | Latency | Notes |
|-----------|---------|-------|
| Ownership check SELECT | 5ms | Partition key lookup |
| UPDATE | 5ms | Partition key write |
| Response SELECT | 5ms | Partition key lookup |
| Total round-trip | 15–25ms | Three sequential DB calls |

### Related Endpoints

- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Read current state before updating
- [GET /api/v1/videos/by-tag/{tag}](/services/video-catalog/get-by-tag/) - Browse videos by the tags you've set
- [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) - Check video processing status

## Further Learning

- [Cassandra UPDATE Semantics](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useUpdateRows.html)
- [Lightweight Transactions in Cassandra](https://docs.datastax.com/en/cassandra-oss/3.x/cassandra/dml/dmlLtwtTransactions.html)
- [RBAC Patterns](https://auth0.com/docs/manage-users/access-control/rbac)
- [Cassandra Collection Updates](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useCollections.html)
