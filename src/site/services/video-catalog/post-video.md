---
title: "POST /api/v1/videos"
description: "Submit a new video for processing and publication"
endpoint: "/api/v1/videos"
method: "POST"
spec_artifact: "/services/video-catalog/_specs/post-video.spec.md"
concepts:
  - background-processing
  - status-tracking
  - pending-processing-ready-state-machine
  - youtube-api-integration
  - 202-accepted-pattern
order: 3
draft: true
---

# POST /api/v1/videos - Submit a Video

## Overview

This endpoint accepts a YouTube URL and queues a new video for ingestion into KillrVideo. Rather than completing synchronously, it immediately returns **202 Accepted** and hands off work to a background processing pipeline. The video passes through a state machine: `PENDING → PROCESSING → READY` (or `ERROR`).

**Why it exists**: Video ingestion involves calling the YouTube Data API, extracting metadata, generating thumbnails, and indexing — all of which take time. Returning 202 immediately improves perceived performance and decouples submission from processing.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos`
- **Auth Required**: Yes — `creator` role
- **Success Status**: 202 Accepted

### Request Body

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Optional custom title override"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `youtubeUrl` | string (URI) | Yes | Full YouTube watch URL |
| `title` | string | No | Custom title; if omitted, fetched from YouTube |

### Response Body (202 Accepted)

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Introduction to Apache Cassandra",
  "description": null,
  "location": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "tags": [],
  "previewImageLocation": null,
  "addedDate": "2025-10-31T10:30:00Z",
  "status": "PENDING"
}
```

Note that `previewImageLocation` and `description` may be `null` immediately after submission — they are populated during background processing.

## Cassandra Concepts Explained

### Status Tracking with a State Machine

The video goes through a defined sequence of states stored in the `videos` table. This is a simple but powerful pattern for tracking asynchronous work:

```
PENDING     → Initial state after submission
PROCESSING  → Background job has picked it up
READY       → Fully processed, visible to viewers
ERROR       → Processing failed (see error_reason field)
```

Because Cassandra writes are extremely fast, updating the status column is a cheap, non-blocking operation. Polling clients can call [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) to check progress.

### The 202 Accepted Pattern

HTTP 201 Created means "the resource exists right now." HTTP **202 Accepted** means "I received your request and will process it — but it's not done yet." This is the correct semantic for asynchronous workflows.

Clients should:
1. Receive the `videoId` from the 202 response
2. Poll [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) until status is `READY`
3. Then fetch the full video with [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/)

### Background Processing

After the initial database write, a background worker (or scheduled task) processes the video:

```
Background Worker:
  1. Fetch metadata from YouTube Data API (title, description, duration, tags)
  2. Download thumbnail URL
  3. Update videos table: status = PROCESSING
  4. Complete all enrichment
  5. Update videos table: status = READY
  6. Write to latest_videos table (for home feed)
```

## Data Model

### Table: `videos`

```cql
CREATE TABLE killrvideo.videos (
    videoid                 uuid PRIMARY KEY,
    userid                  uuid,
    name                    text,
    description             text,
    location                text,        -- YouTube URL
    location_type           int,         -- 0 = YouTube
    preview_image_location  text,        -- Thumbnail URL
    tags                    set<text>,   -- Tag set for search
    added_date              timestamp,
    views                   counter,
    status                  text,        -- PENDING/PROCESSING/READY/ERROR
    error_reason            text         -- Populated when status = ERROR
);
```

**Key characteristics**:
- **Partition Key**: `videoid` (UUID v4)
- **Status field**: Text enum updated by background worker
- **tags**: A Cassandra `set<text>` — unordered, de-duplicated collection

## Database Queries

### 1. Initial Insert (PENDING status)

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.videos (
    videoid, userid, name, location, location_type,
    tags, added_date, status
) VALUES (
    550e8400-e29b-41d4-a716-446655440000,
    a1b2c3d4-e5f6-7890-abcd-ef1234567890,
    'Introduction to Apache Cassandra',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    0,
    {},
    '2025-10-31T10:30:00Z',
    'PENDING'
);
```

### 2. Background Worker Updates Status

**Equivalent CQL**:
```cql
UPDATE killrvideo.videos
SET status = 'PROCESSING'
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;

-- After enrichment completes:
UPDATE killrvideo.videos
SET status = 'READY',
    description = 'A comprehensive introduction...',
    preview_image_location = 'https://img.youtube.com/vi/.../mqdefault.jpg',
    tags = {'cassandra', 'databases', 'nosql'}
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

### 3. Write to latest_videos (after READY)

```cql
INSERT INTO killrvideo.latest_videos (
    added_date_bucket, added_date, videoid, name,
    preview_image_location, userid
) VALUES (
    '2025-10-31',
    '2025-10-31T10:30:00Z',
    550e8400-e29b-41d4-a716-446655440000,
    'Introduction to Apache Cassandra',
    'https://img.youtube.com/vi/.../mqdefault.jpg',
    a1b2c3d4-e5f6-7890-abcd-ef1234567890
);
```

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos (with JWT)           │
│    { youtubeUrl, title? }                                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Authenticate: verify JWT, extract creator userId      │
│    └─ Not authenticated? → 401 Unauthorized              │
│    └─ Wrong role? → 403 Forbidden                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Validate request body                                 │
│    ├─ youtubeUrl is a valid URI? → proceed               │
│    └─ Invalid? → 422 Validation Error                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Generate videoId (uuid4), capture added_date (now)    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. INSERT into videos table with status = PENDING        │
│    (title from request body if provided, else TBD)       │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Enqueue background job (videoId, youtubeUrl)          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 7. Return 202 Accepted with VideoDetailResponse          │
│    (status = PENDING, some fields may be null)           │
└──────────────────────────────────────────────────────────┘

           [Background Worker — runs asynchronously]
┌──────────────────────────────────────────────────────────┐
│ A. Pick up job from queue                                │
│ B. Call YouTube Data API → fetch title, description,     │
│    tags, thumbnail                                       │
│ C. UPDATE videos SET status = 'PROCESSING'               │
│ D. UPDATE videos SET status = 'READY', metadata...       │
│ E. INSERT into latest_videos                             │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Why YouTube-Only?

KillrVideo is a YouTube wrapper — it does not store video files. The `location` column stores the YouTube URL, and the player embeds the YouTube iframe. This vastly simplifies storage and CDN concerns at the cost of relying on an external service.

### 2. Title Resolution Priority

1. If `title` is provided in the request body → use it directly
2. If `title` is omitted → fetch from YouTube API during background processing
3. If YouTube API fails → use the URL string as a fallback

### 3. Idempotency Risk

Submitting the same YouTube URL twice creates two separate video records (different `videoId`s). There is no deduplication in the current implementation. A production system might index on `location` to detect duplicates before creating a new record.

### 4. Error Handling for Background Failures

If the YouTube API is down or returns an error, the background worker sets:
```
status = 'ERROR'
error_reason = 'YouTube API unavailable: 503'
```

Users can see this via [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/). The video never appears in the public feed because `latest_videos` is only written when status reaches `READY`.

### 5. Cassandra `set<text>` for Tags

The `tags` column uses Cassandra's native `set<text>` collection type. Sets automatically deduplicate values:
```cql
tags = {'cassandra', 'nosql', 'cassandra'}  -- stored as {'cassandra', 'nosql'}
```

When the background worker enriches the video, it updates the entire tag set atomically.

## Developer Tips

### Common Pitfalls

1. **Polling too aggressively**: Background processing may take 5–30 seconds. Use exponential backoff when polling status, not tight loops.

2. **Assuming data is complete at 202**: The response body may have `null` fields. Always check `status` before displaying a video.

3. **Not handling ERROR status in the client**: Build UI for the failure case — show an error state and give the user a retry option.

4. **Using the wrong HTTP status**: 201 Created would be incorrect here because the resource is not yet fully formed. 202 Accepted is the right semantic.

### Best Practices

1. **Validate the YouTube URL format** before queuing the job to fail fast without consuming a background worker slot.

2. **Use a separate status-check endpoint** rather than re-fetching full video metadata on every poll.

3. **Implement webhook callbacks** as an alternative to polling — when the video is READY, POST to a client-provided callback URL.

4. **Set a processing timeout**: If a job stays in PROCESSING for more than 5 minutes, mark it ERROR and alert ops.

### Performance Expectations

| Operation | Latency | Notes |
|-----------|---------|-------|
| POST endpoint response | < 50ms | Just a DB insert + queue enqueue |
| Background processing | 5–30s | YouTube API is the bottleneck |
| Status poll (PENDING) | < 5ms | Partition key lookup |
| Status poll (READY) | < 5ms | Same lookup |

### Related Endpoints

- [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) - Poll processing status
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Fetch full video details once READY
- [POST /api/v1/videos/preview](/services/video-catalog/post-preview/) - Validate a YouTube URL before submitting
- [GET /api/v1/videos/latest](/services/video-catalog/get-latest/) - See new videos appear here once READY

## Further Learning

- [HTTP 202 Accepted](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202)
- [Cassandra Collection Types](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useCollections.html)
- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/videos/list)
- [Background Job Patterns](https://docs.celeryq.dev/en/stable/userguide/tasks.html)
