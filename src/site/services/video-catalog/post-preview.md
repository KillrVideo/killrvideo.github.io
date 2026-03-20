---
title: "POST /api/v1/videos/preview"
description: "Validate a YouTube URL and preview metadata before submitting a video"
endpoint: "/api/v1/videos/preview"
method: "POST"
spec_artifact: "/services/video-catalog/_specs/post-preview.spec.md"
concepts:
  - external-api-integration
  - preflight-validation
  - no-database-write
  - youtube-oembed
order: 14
draft: true
---

# POST /api/v1/videos/preview - Preview a YouTube URL

## Overview

This endpoint accepts a YouTube URL and returns metadata fetched from YouTube — specifically the video title — without creating any database record. It is a **preflight check** that lets the UI show users what their video will look like before they commit to submitting it.

**Why it exists**: Good UX shows users a preview ("Your video will appear as: 'Introduction to Apache Cassandra'") before they click submit. This endpoint is purely a read-through to YouTube's API — no state is changed in the database.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/videos/preview`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Request Body

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `youtubeUrl` | string (URI) | Yes | Full YouTube watch URL |

### Response Body

```json
{
  "title": "Introduction to Apache Cassandra"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | YouTube URL is invalid, the video is private, or the API is unavailable |
| 422 | Request body validation error (malformed URL) |

## Cassandra Concepts Explained

This endpoint involves **no Cassandra operations**. It is entirely a pass-through to the YouTube API. That makes it an excellent illustration of a pattern common in microservices: an endpoint that aggregates or validates external data before the user commits to an action.

### Why POST for a Read Operation?

REST purists might argue this should be a `GET` with a query parameter:
```
GET /api/v1/videos/preview?youtubeUrl=https://...
```

However, using `POST` with a request body is justified here because:
1. **Long URLs**: YouTube URLs with tracking parameters can be very long, exceeding safe URL lengths
2. **URL encoding complexity**: Embedding a URL as a query parameter requires double-encoding
3. **Consistency with the submit endpoint**: `POST /api/v1/videos` also takes a request body with `youtubeUrl`

### External API Integration Pattern

This endpoint demonstrates how to safely integrate with third-party APIs:

```
Client → KillrVideo API → YouTube API
                             ↓
                     (title, description, etc.)
                             ↓
         KillrVideo API → Client (subset of YouTube response)
```

**Key principles**:
1. **Never expose the raw API response**: Filter to only what the client needs
2. **Handle failure gracefully**: YouTube may be slow, rate-limited, or down
3. **Set timeouts**: Don't let a slow YouTube API hang the client indefinitely
4. **Cache aggressively**: The same URL always returns the same title (videos don't change titles often)

### YouTube oEmbed vs. Data API

There are two ways to fetch YouTube metadata:

**oEmbed (simpler)**:
```http
GET https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json
```
Returns: `{ "title": "...", "thumbnail_url": "...", "author_name": "..." }`
No API key required. Limited metadata.

**YouTube Data API v3 (full)**:
```http
GET https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&key=API_KEY&part=snippet
```
Returns: Full metadata including description, tags, duration, view count.
Requires an API key. Has rate limits.

The preview endpoint likely uses oEmbed for its simplicity and no-key-required access.

### Extracting the Video ID from the URL

YouTube URLs come in several formats:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/embed/dQw4w9WgXcQ
https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s
```

The implementation must extract the video ID (`dQw4w9WgXcQ`) from all these formats:

```python
import re
from urllib.parse import urlparse, parse_qs

def extract_youtube_id(url: str) -> str | None:
    patterns = [
        r'youtube\.com/watch\?.*v=([A-Za-z0-9_-]{11})',
        r'youtu\.be/([A-Za-z0-9_-]{11})',
        r'youtube\.com/embed/([A-Za-z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None
```

## Data Model

This endpoint does not read or write any Cassandra tables. All data comes from and goes to the YouTube API in real time.

## Database Queries

**None** — this endpoint makes no Cassandra queries.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/videos/preview              │
│    { "youtubeUrl": "https://youtube.com/watch?v=..." }  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate youtubeUrl is a valid URI                    │
│    └─ Invalid URL format? → 422 Validation Error         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Extract YouTube video ID from URL                     │
│    └─ Can't parse video ID? → 400 Bad Request            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Call YouTube oEmbed or Data API                       │
│    GET youtube.com/oembed?url=...                        │
│    ├─ 404 (video not found)? → 400 "Video not found"    │
│    ├─ 403 (private video)?  → 400 "Video is private"    │
│    ├─ Timeout/5xx?          → 400 "YouTube unavailable" │
│    └─ 200 OK?               → Continue                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Extract title from YouTube response                   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with VideoPreviewResponse               │
│    { "title": "Introduction to Apache Cassandra" }       │
└──────────────────────────────────────────────────────────┘
```

**No Cassandra queries**
**Expected latency**: 100–500ms (dominated by YouTube API call)

## Special Notes

### 1. Caching Prevents Redundant External Calls

If the same URL is previewed multiple times (e.g., the user clicks "preview" repeatedly), caching the response for 30 minutes avoids hitting the YouTube API on every request:

```python
from functools import lru_cache
from datetime import timedelta

# Cache: youtube_url → (title, expires_at)
preview_cache = {}

async def get_youtube_title(url: str) -> str:
    if url in preview_cache:
        title, expires = preview_cache[url]
        if expires > datetime.now():
            return title

    title = await fetch_from_youtube(url)
    preview_cache[url] = (title, datetime.now() + timedelta(minutes=30))
    return title
```

For production, use Redis instead of an in-process dict.

### 2. Error Message Clarity

When the YouTube API fails, provide actionable error messages:

| Error | Message to Return |
|-------|-----------------|
| Video not found (404) | "This YouTube video could not be found. Check the URL." |
| Private video (401/403) | "This video is private. Only public videos can be submitted." |
| API unavailable | "YouTube is currently unavailable. Please try again shortly." |
| Invalid URL | "Please enter a valid YouTube URL." |

### 3. This Does Not Reserve the Video

Calling this endpoint does NOT create a video record. Two users can preview the same URL, and either or both can subsequently submit it with `POST /api/v1/videos`. There is no locking or reservation mechanism.

### 4. The Title May Change

YouTube video titles can be updated by their owners. The title returned here is accurate at the time of the preview call, but by the time the video is processed, the title might be different. The background worker fetches the title again during enrichment.

### 5. No Authentication Required

Unlike video submission, previewing a URL requires no authentication. This allows the "paste a URL and see a preview" flow to work before the user logs in.

## Developer Tips

### Common Pitfalls

1. **No timeout on the YouTube call**: Set a reasonable timeout (5–10 seconds). If YouTube takes 30 seconds, the user shouldn't have to wait.

2. **Exposing YouTube API errors directly**: Sanitize error messages. Users don't need to see "HTTP 403: quotaExceeded" — show "YouTube is currently unavailable."

3. **Not caching**: The same URL is often previewed multiple times. Cache it.

4. **Forgetting URL normalization**: `https://youtu.be/abc123` and `https://youtube.com/watch?v=abc123` are the same video. Normalize before caching.

5. **Returning 200 with error message in body**: If the YouTube API returns an error, propagate it as an HTTP error (400), not a 200 with `{ "error": "..." }`.

### Best Practices

1. **Implement retry logic for transient errors**: YouTube may return 503 intermittently. Retry once with a short delay before returning an error.

2. **Validate URL format before making the external call**: Don't hit the YouTube API with clearly malformed URLs.

3. **Cache with URL normalization**: Normalize the URL (extract video ID, reconstruct canonical URL) as the cache key.

4. **Consider rate limiting**: Protect your YouTube API quota by rate-limiting the preview endpoint.

5. **Return thumbnail URL too**: The oEmbed endpoint also returns a thumbnail. Consider adding it to the response for a richer preview.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Cache hit | < 5ms | Cached from previous preview |
| YouTube API call (healthy) | 100–300ms | Network round-trip to YouTube |
| YouTube API slow | 500ms–5s | Set timeout, show loading state |
| Timeout | 5–10s | Return error after configured timeout |

### Related Endpoints

- [POST /api/v1/videos](/services/video-catalog/post-video/) - Actually submit the video after previewing
- [GET /api/v1/videos/{id}/status](/services/video-catalog/get-video-status/) - Check status after submission

## Further Learning

- [YouTube oEmbed API](https://developers.google.com/youtube/oembed)
- [YouTube Data API v3 - Videos](https://developers.google.com/youtube/v3/docs/videos/list)
- [HTTP Timeouts Best Practices](https://engineering.silverfin.com/http-timeouts/)
- [External API Integration Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
