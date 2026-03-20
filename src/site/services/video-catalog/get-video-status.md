---
title: "GET /api/v1/videos/id/{video_id}/status"
description: "Lightweight polling endpoint to check video processing status"
endpoint: "/api/v1/videos/id/{video_id}/status"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-video-status.spec.md"
concepts:
  - status-enum
  - polling-pattern
  - lightweight-projection
  - async-workflow-monitoring
order: 8
draft: true
---

# GET /api/v1/videos/id/{video_id}/status - Video Processing Status

## Overview

After submitting a video with [POST /api/v1/videos](/services/video-catalog/post-video/), the client needs a way to check whether processing is complete without fetching the full video object on every poll. This lightweight endpoint returns only the `status` field — a minimal projection from the `videos` table.

**Why it exists**: Polling for full video objects wastes bandwidth. By returning only the status field (a tiny payload), clients can poll at high frequency without significant overhead.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/id/{video_id}/status`
- **Auth Required**: Yes — creator or moderator role
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The video to check |

### Request

```http
GET /api/v1/videos/id/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer <jwt-token>
```

### Response Body

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING"
}
```

## Cassandra Concepts Explained

### Lightweight Projections (Column Selection)

Instead of retrieving all columns of the `videos` row, this endpoint requests only the columns it needs: `videoid` and `status`. In CQL, this is done by naming specific columns in the SELECT:

```cql
SELECT videoid, status
FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Why this matters**: Cassandra reads are row-oriented, meaning even a narrow SELECT still reads from the same partition. However, reading fewer columns reduces:
- Network transfer between Cassandra and the application server
- Application memory for deserializing the response
- Response serialization time

For a table with large columns (e.g., `description` could be several KB), projecting only `status` is meaningfully faster.

### The Status Enum

The `status` column is stored as `text` in Cassandra but treated as a finite enumeration at the application layer:

| Value | Meaning |
|-------|---------|
| `PENDING` | Submitted, awaiting background worker |
| `PROCESSING` | Background worker is actively enriching |
| `READY` | Fully processed, visible to public |
| `ERROR` | Processing failed permanently |

The application validates that only these four values are written, but Cassandra itself has no enum type — it stores any text string you write.

### Polling Pattern in Async Workflows

This endpoint exists specifically to support the **polling pattern** for asynchronous operations:

```
Client                              Server
  |                                   |
  |-- POST /videos -----------------> |  (submit)
  |<-- 202 Accepted, videoId -------- |
  |                                   |
  |-- GET /videos/{id}/status ------> |  (poll)
  |<-- 200 { status: "PENDING" } ---- |
  |                                   |
  |  [wait 2 seconds]                 |
  |                                   |
  |-- GET /videos/{id}/status ------> |  (poll)
  |<-- 200 { status: "PROCESSING" } - |
  |                                   |
  |  [wait 2 seconds]                 |
  |                                   |
  |-- GET /videos/{id}/status ------> |  (poll)
  |<-- 200 { status: "READY" } ------ |
  |                                   |
  |-- GET /videos/{id} -------------> |  (fetch full details)
  |<-- 200 VideoDetailResponse ------- |
```

## Data Model

### Table: `videos` (projected columns)

```cql
CREATE TABLE killrvideo.videos (
    videoid uuid PRIMARY KEY,
    -- ...other columns...
    status  text,      -- ← what this endpoint reads
    error_reason text  -- ← useful if status = ERROR
);
```

## Database Queries

### Query: Fetch Status by Video ID

**Equivalent CQL**:
```cql
SELECT videoid, status, error_reason
FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: O(1) — partition key lookup. Extremely fast even under heavy polling.

**Why `error_reason` too?** If status is `ERROR`, clients need to know why (e.g., "YouTube video not found", "Private video") to display a useful message.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/id/{video_id}/status  │
│    with Authorization header                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Authenticate: verify JWT                              │
│    ├─ Invalid/missing JWT? → 401 Unauthorized            │
│    └─ Valid JWT? → Continue                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Validate video_id UUID format                         │
│    └─ Invalid format? → 422 Validation Error             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. SELECT videoid, status FROM videos WHERE videoid = ?  │
│    ├─ Not found? → 404 Video not found                   │
│    └─ Found? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Return 200 with VideoStatusResponse                   │
│    { videoId, status }                                   │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 SELECT (narrow projection)
**Expected latency**: < 5ms

## Special Notes

### 1. Auth Requirement

This endpoint requires authentication to prevent enumeration attacks — an unauthenticated attacker should not be able to probe for video IDs by polling status endpoints. Only creators (who submitted videos) and moderators can check processing status.

In contrast, [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) is public — once a video is READY, anyone can view it.

### 2. Terminal States

`READY` and `ERROR` are **terminal states** — once reached, the status will not change. Clients should stop polling when they receive either:

```python
terminal_states = {"READY", "ERROR"}

while True:
    response = get_video_status(video_id)
    if response.status in terminal_states:
        break
    await asyncio.sleep(exponential_backoff(attempt))
```

### 3. Exponential Backoff

Clients should not poll at a fixed fast interval. Use **exponential backoff**:
- First poll: after 1 second
- Second poll: after 2 seconds
- Third poll: after 4 seconds
- Cap at 30 seconds

Processing typically takes 5–30 seconds. Aggressive polling wastes resources and can overwhelm the API.

### 4. Error Reason Is Informational Only

When status is `ERROR`, the `error_reason` field (if included in the response) describes the failure. This is useful for developer debugging but should be sanitized before displaying to end users — it may contain technical stack traces or API error messages.

### 5. Authorization Scope

This endpoint uses a broader authorization check: any authenticated `creator` or `moderator` can check the status of any video, not just their own. This simplifies the implementation — adding an ownership check would require an extra lookup of the video's `userid` field.

A stricter implementation would verify that the requesting user owns the video (or is a moderator) before returning status.

## Developer Tips

### Common Pitfalls

1. **Polling too fast**: Use exponential backoff. Hammering this endpoint at 10 requests/second provides no benefit over 1 request/5 seconds.

2. **Not handling ERROR state**: Build a UI for failure — show the error and offer a "retry" or "delete and resubmit" option.

3. **Treating this response as authoritative video data**: This returns only `videoId` and `status`. For anything else, use [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/).

4. **Forgetting to include Authorization header**: Unlike the public video detail endpoint, this requires a JWT.

### Best Practices

1. **Implement client-side polling with a timeout**: If status has not reached READY within 5 minutes, assume ERROR and prompt the user.

2. **Cache the terminal state**: Once you receive READY or ERROR, cache it locally — no need to re-check.

3. **Use WebSockets for real-time updates**: A more advanced approach sends the status update to the client via WebSocket/SSE when processing completes, eliminating polling entirely.

4. **Log ERROR reasons server-side**: Even if you don't show them to users, log all ERROR states with their reason for operational monitoring.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Status check (any state) | < 5ms | Narrow column projection |
| 100 concurrent polls | < 10ms each | Cassandra handles this easily |

### Related Endpoints

- [POST /api/v1/videos](/services/video-catalog/post-video/) - Submit a video (start the workflow)
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Full details once READY
- [PUT /api/v1/videos/{id}](/services/video-catalog/put-video/) - Update metadata after READY

## Further Learning

- [HTTP Polling vs WebSockets](https://ably.com/blog/websockets-vs-long-polling)
- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [CQL Column Projections](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_reference/cqlSelect.html)
