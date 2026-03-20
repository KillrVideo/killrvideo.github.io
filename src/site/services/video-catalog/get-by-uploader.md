---
title: "GET /api/v1/videos/by-uploader/{uploader_id}"
description: "List all videos uploaded by a specific user using a secondary access pattern"
endpoint: "/api/v1/videos/by-uploader/{uploader_id}"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-by-uploader.spec.md"
concepts:
  - secondary-access-patterns
  - sai-on-non-primary-key
  - denormalized-user-video-table
  - pagination
order: 9
draft: true
---

# GET /api/v1/videos/by-uploader/{uploader_id} - Videos by Uploader

## Overview

This endpoint returns all videos submitted by a specific user. It is a classic **secondary access pattern** — the primary key for the `videos` table is `videoid`, but here we need to query by `userid`. This requires either a secondary index or a dedicated denormalized table.

**Why it exists**: User profile pages need to display a creator's video portfolio. Without this endpoint, there would be no way to show "all videos by this person."

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/by-uploader/{uploader_id}`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `uploader_id` | UUID | The user whose videos to fetch |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 9 | Results per page (max 20) |

### Request

```http
GET /api/v1/videos/by-uploader/a1b2c3d4-e5f6-7890-abcd-ef1234567890?page=1&pageSize=9
```

### Response Body

```json
{
  "items": [
    {
      "videoId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Introduction to Apache Cassandra",
      "previewImageLocation": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
      "addedDate": "2025-10-31T10:30:00Z"
    }
  ],
  "total": 7,
  "page": 1,
  "pageSize": 9
}
```

## Cassandra Concepts Explained

### Secondary Access Patterns

In relational databases, you can add a WHERE clause on any column and the database figures out how to resolve it (using indexes, table scans, etc.). In Cassandra, **every query must include the partition key** — unless you have a secondary index.

The `videos` table is partitioned by `videoid`. To query by `userid`, you have two options:

**Option 1: Denormalized table**
```cql
CREATE TABLE killrvideo.user_videos (
    userid    uuid,
    videoid   uuid,
    added_date timestamp,
    -- summary fields for display
    PRIMARY KEY ((userid), added_date, videoid)
) WITH CLUSTERING ORDER BY (added_date DESC, videoid ASC);
```
Every video insert also inserts a row here. Queries by userid are direct partition key lookups.

**Option 2: SAI on userid in videos table**
```cql
CREATE CUSTOM INDEX videos_userid_idx
ON killrvideo.videos(userid)
USING 'StorageAttachedIndex';
```
Query the `videos` table directly with `WHERE userid = ?`.

KillrVideo uses the SAI approach for simplicity. The tradeoff is that the SAI query is slightly less efficient than a partition key lookup, but it eliminates the need to maintain a separate table.

### SAI on a Non-Primary-Key Column

An SAI index on `userid` enables filtering by uploader without a full table scan. Under the hood:
1. Cassandra's SAI index maintains a sorted list of `(userid → token)` mappings
2. A query `WHERE userid = ?` looks up the userid in this index to find which tokens (and thus which partitions) match
3. Those partitions are fetched directly

This is efficient even for users with many videos because the index narrows the search space before any actual row reading.

### The Trade-off: Denormalized Table vs. SAI

| Approach | Read Performance | Write Complexity | Storage |
|----------|-----------------|------------------|---------|
| Denormalized `user_videos` table | Fastest (partition key) | High (two writes) | 2x |
| SAI on `videos.userid` | Fast (indexed) | Low (one write) | ~1.3x |

For a learning platform like KillrVideo, the SAI approach is preferred for its simplicity. A high-scale production system might use the denormalized table approach.

## Data Model

### Option A: Denormalized Table (alternative design)

```cql
CREATE TABLE killrvideo.user_videos (
    userid          uuid,
    added_date      timestamp,
    videoid         uuid,
    name            text,
    preview_image_location text,
    PRIMARY KEY ((userid), added_date, videoid)
) WITH CLUSTERING ORDER BY (added_date DESC, videoid ASC);
```

### Option B: SAI on `videos` (current approach)

```cql
CREATE TABLE killrvideo.videos (
    videoid uuid PRIMARY KEY,
    userid  uuid,
    name    text,
    preview_image_location text,
    added_date timestamp,
    status  text
    -- ... other columns
);

-- SAI index enables filtering by uploader
CREATE CUSTOM INDEX videos_userid_idx
ON killrvideo.videos(userid)
USING 'StorageAttachedIndex';
```

## Database Queries

### Query: Find Videos by Uploader

**Equivalent CQL**:
```cql
SELECT videoid, userid, name, preview_image_location, added_date
FROM killrvideo.videos
WHERE userid = a1b2c3d4-e5f6-7890-abcd-ef1234567890
  AND status = 'READY'
ORDER BY added_date DESC
LIMIT 9
ALLOW FILTERING;
```

**Note**: `ORDER BY` in CQL requires the column to be a clustering column. With SAI on a non-clustering column, ordering is handled at the application layer by sorting the result set.

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/by-uploader/{id}      │
│    ?page=1&pageSize=9                                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate UUID format of uploader_id                   │
│    └─ Invalid format? → 422                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Query videos WHERE userid = ? AND status = 'READY'    │
│    with skip and limit for pagination                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Sort results by added_date DESC (application layer)   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Assemble PaginatedResponse and return 200 OK          │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Empty Result for Unknown User

If no videos are found for the given `uploader_id`, the response is:
```json
{ "items": [], "total": 0, "page": 1, "pageSize": 9 }
```

This is NOT a 404. The uploader may exist but have no videos, or they may not exist at all. The endpoint returns an empty list in both cases.

### 2. Only READY Videos Are Shown

Like [GET /api/v1/videos/by-tag/{tag}](/services/video-catalog/get-by-tag/), only videos with `status = 'READY'` are shown publicly. A creator's own profile page might want to show PENDING and ERROR videos too — that would require a separate authenticated endpoint.

### 3. Large Uploader Libraries

A prolific creator might have hundreds or thousands of videos. SAI handles this gracefully with proper pagination. The `skip` parameter in the Data API is used to implement page offsets:
- Page 1: `skip=0, limit=9`
- Page 2: `skip=9, limit=9`

### 4. Creator Context

This endpoint is often displayed alongside the uploader's profile, fetched from [GET /api/v1/users/{user_id}](/services/account-management/get-user-by-id/). The two calls can be made in parallel:
```
GET /users/{uploader_id}          (profile details)
GET /videos/by-uploader/{id}      (video list)
```

## Developer Tips

### Common Pitfalls

1. **Returning 404 for users with no videos**: The correct response is 200 with an empty items array.

2. **Not filtering by READY status**: Showing PENDING videos publicly exposes incomplete content.

3. **N+1 when displaying uploader names**: If listing videos from multiple uploaders, avoid fetching each user separately. Batch the user lookups.

4. **Assuming sorted order**: SAI results may not be sorted by `added_date`. Sort in application code if ordering matters.

### Best Practices

1. **Show video count on profile pages**: Fetch the total from this endpoint to display "X videos" without listing all of them.

2. **Combine with user lookup**: Fetch user profile and video list in parallel to minimize page load time.

3. **Consider dedicated `user_videos` table for high-volume creators**: If any creator has tens of thousands of videos, the SAI approach may become less efficient than a dedicated denormalized table.

4. **Cache per-uploader results**: The first page of a creator's videos is a good caching target (TTL of 1–5 minutes).

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| User with few videos | 5–15ms | SAI lookup + small result set |
| User with many videos (paginated) | 10–20ms | SAI + larger index scan |
| Empty result (user has no videos) | 5–10ms | Quick empty result |

### Related Endpoints

- [GET /api/v1/users/{user_id}](/services/account-management/get-user-by-id/) - Uploader's profile details
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Individual video details
- [GET /api/v1/videos/latest](/services/video-catalog/get-latest/) - All users' latest videos

## Further Learning

- [Cassandra Secondary Indexes](https://cassandra.apache.org/doc/latest/cassandra/cql/indexes.html)
- [SAI vs. Denormalized Tables](https://docs.datastax.com/en/astra-db-serverless/databases/sai-overview.html)
- [Cassandra Data Modeling Guide](https://cassandra.apache.org/doc/latest/cassandra/data-modeling/)
