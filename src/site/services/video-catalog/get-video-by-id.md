---
title: "GET /api/v1/videos/id/{video_id}"
description: "Retrieve full video metadata by UUID — the canonical partition key lookup"
endpoint: "/api/v1/videos/id/{video_id}"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-video-by-id.spec.md"
concepts:
  - partition-key-lookup
  - uuid-path-parameters
  - full-row-read
  - 404-handling
order: 6
draft: true
---

# GET /api/v1/videos/id/{video_id} - Get Video Details

## Overview

This endpoint fetches the complete metadata for a single video by its UUID. It is the textbook example of Cassandra's most efficient query pattern: a **direct partition key lookup**. The result includes all video fields — title, description, tags, view count, status, and more.

**Why it exists**: Every video detail page, embed, and share link resolves to this endpoint. It must be fast and reliable since it sits on the critical path for all video playback.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/id/{video_id}`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The unique identifier of the video |

### Request

```http
GET /api/v1/videos/id/550e8400-e29b-41d4-a716-446655440000
```

### Response Body

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Introduction to Apache Cassandra",
  "description": "A comprehensive introduction to Apache Cassandra data modeling...",
  "location": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "tags": ["cassandra", "nosql", "databases"],
  "previewImageLocation": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  "addedDate": "2025-10-31T10:30:00Z",
  "views": 1042,
  "status": "READY"
}
```

## Cassandra Concepts Explained

### The Partition Key Lookup

The most important performance characteristic of any Cassandra query is whether it uses the partition key. When you query by partition key:

1. Cassandra hashes the key using a consistent hash function (Murmur3 by default)
2. The hash value maps to a **token range** owned by a specific replica set
3. The query goes directly to those replicas — no broadcast, no coordination
4. The row is found in O(1) time regardless of table size

For the `videos` table, `videoid` is the partition key. This means fetching any video by ID is equally fast whether the table has 100 videos or 100 million.

```
Client → Hash(videoid) → Token → Replica Node → Data
                          ↓
         No other nodes are involved
```

### How Consistent Hashing Works

Imagine a ring of 360 degrees. Each Cassandra node "owns" a segment of this ring. When you insert data, the partition key is hashed to a number, which maps to a position on the ring. That position determines which node stores the data.

```
           Node A (0°–120°)
          /
Ring: ───A───────B───────C───
                |         \
          Node B (120°–240°) Node C (240°–360°)

videoid hash = 75° → stored on Node A
```

This is why partition key lookups are O(1) — you always know exactly where to look.

### UUID as a Partition Key

`uuid` is an ideal partition key for several reasons:
- **Uniform distribution**: Random UUIDs distribute evenly across nodes (no hot spots)
- **Globally unique**: Generated without coordination across services
- **URL-safe**: Hexadecimal characters, safe to use in paths
- **Immutable**: A video's ID never changes

## Data Model

### Table: `videos`

```cql
CREATE TABLE killrvideo.videos (
    videoid                 uuid PRIMARY KEY,   -- Partition key
    userid                  uuid,
    name                    text,
    description             text,
    location                text,               -- YouTube URL
    location_type           int,                -- 0 = YouTube
    preview_image_location  text,
    tags                    set<text>,
    added_date              timestamp,
    views                   counter,
    status                  text,               -- PENDING/PROCESSING/READY/ERROR
    error_reason            text
);
```

**Access pattern**: Always accessed by `videoid`. One row = one video.

## Database Queries

### Query: Fetch Video by ID

**Equivalent CQL**:
```cql
SELECT videoid, userid, name, description, location,
       preview_image_location, tags, added_date, views, status
FROM killrvideo.videos
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: O(1) — single partition read, sub-millisecond on a well-tuned cluster.

**Result**: Either zero rows (video not found) or exactly one row (videos table has a simple partition key, so at most one row per videoid).

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/id/{video_id}         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. FastAPI validates UUID format                         │
│    ├─ Invalid format? → 422 Validation Error             │
│    └─ Valid UUID? → Continue                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Query videos table                                    │
│    SELECT * FROM videos WHERE videoid = ?                │
│    ├─ Not found? → 404 Video not found                   │
│    └─ Found? → Continue                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Map document to VideoDetailResponse model             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Return 200 OK with VideoDetailResponse                │
└──────────────────────────────────────────────────────────┘
```

**Total queries**: 1 SELECT
**Expected latency**: 5–10ms

## Special Notes

### 1. READY Status Is Not Enforced Here

Unlike the tag and latest-feed endpoints, this endpoint returns videos regardless of status. A video with `status = "PENDING"` or `"ERROR"` is still returned — the response includes the `status` field so clients can decide how to render it.

**Why**: Creators and moderators need to see their own videos at all stages, not just the public-ready ones. Clients should check the `status` field and show appropriate UI.

### 2. Null Fields During Processing

When a video is in PENDING or PROCESSING state, several fields may be `null`:
- `description` — not yet fetched from YouTube
- `previewImageLocation` — not yet downloaded
- `tags` — not yet extracted

Design your client to handle nullable fields gracefully.

### 3. View Count Eventual Consistency

The `views` field is a counter column and may not reflect real-time increments. The value returned is accurate as of the last read quorum — typically within milliseconds, but not strictly synchronous with ongoing increments.

### 4. The `/id/` Prefix in the Path

You may notice the path is `/videos/id/{video_id}` rather than the more REST-conventional `/videos/{video_id}`. This is intentional to avoid path collisions with the `/videos/latest`, `/videos/trending`, and `/videos/by-tag/{tag}` routes — routers resolve paths in order, and without the `/id/` prefix, routing would be ambiguous.

### 5. Caching Strategy

This endpoint is a strong candidate for HTTP caching:
```
Cache-Control: public, max-age=60
```

A 60-second cache is safe because video metadata changes infrequently, and the `views` count is already eventually consistent. For videos in READY status, consider longer cache times (5–15 minutes).

## Developer Tips

### Common Pitfalls

1. **Displaying PENDING videos as if they're ready**: Always check `status` before showing the video player.

2. **Not handling null fields**: `previewImageLocation` can be null — show a placeholder image.

3. **Assuming views is exact**: Counter values are consistent, not strongly consistent. Display as "approximately X views" in the UI.

4. **Not caching**: This endpoint is read-heavy. Add HTTP caching headers to reduce load.

### Best Practices

1. **Return the full model**: Don't trim fields here — callers (video page, embed player, share preview) each need different subsets, and a full response lets them all use this one endpoint.

2. **Use strict UUID validation in the path**: A non-UUID string in the path should return 422, not 404.

3. **Log 404 metrics**: A spike in 404s for video lookups may indicate dead links or a client caching issue.

4. **Add ETag headers** for client-side caching: The ETag can be derived from the video's `added_date` + `status`.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Cache hit (reverse proxy) | < 1ms | For high-traffic videos |
| Cache miss | 5–10ms | Single partition read |
| Non-existent video (404) | 5–10ms | Same read, different outcome |

### Related Endpoints

- [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) - Lightweight status-only check
- [PUT /api/v1/videos/{id}](/services/video-catalog/put-video/) - Update video metadata
- [GET /api/v1/videos/{id}/related](/services/video-catalog/get-related/) - Recommended related videos
- [POST /api/v1/videos/{id}/view](/services/video-catalog/post-view/) - Increment view count

## Further Learning

- [Cassandra Partition Keys](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html)
- [Consistent Hashing Explained](https://www.toptal.com/big-data/consistent-hashing)
- [HTTP ETag and Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
- [UUID v4 Specification](https://www.rfc-editor.org/rfc/rfc4122)
