---
title: "GET /api/v1/videos/by-tag/{tag_name}"
description: "Find all videos associated with a specific tag using SAI on a collection column"
endpoint: "/api/v1/videos/by-tag/{tag_name}"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-by-tag.spec.md"
concepts:
  - sai-indexes
  - collection-indexing
  - set-type
  - filtering-without-denormalization
  - pagination
order: 4
draft: true
---

# GET /api/v1/videos/by-tag/{tag_name} - Videos by Tag

## Overview

This endpoint returns all videos that have been tagged with a given keyword. Tags let viewers browse related content (e.g., all videos tagged "cassandra" or "nosql"). The query is powered by a **Storage-Attached Index (SAI) on a Cassandra collection column** — one of the most powerful features introduced in Cassandra 5 / Astra DB.

**Why it exists**: Tag-based browsing is a fundamental content discovery mechanism. Without SAI, this would require maintaining a separate denormalized table for every tag — a significant operational burden.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/by-tag/{tag_name}`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tag_name` | string | The tag to filter by (case-insensitive) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 9 | Results per page (max 20) |

### Request

```http
GET /api/v1/videos/by-tag/cassandra?page=1&pageSize=9
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
  "total": 14,
  "page": 1,
  "pageSize": 9
}
```

## Cassandra Concepts Explained

### The `set<text>` Collection Type

The `tags` column in the `videos` table is defined as `set<text>` — a built-in Cassandra collection type. A set is:

- **Unordered**: Elements have no inherent order
- **Deduplicated**: Adding the same tag twice is a no-op
- **Stored inline**: The entire set lives within the video's row

```
videos row for videoId=550e...
  ├── name: "Intro to Cassandra"
  ├── tags: {'cassandra', 'databases', 'nosql'}   ← set<text>
  └── ...
```

### What is a Storage-Attached Index (SAI)?

**Traditional indexes** in Cassandra (secondary indexes pre-SAI) had serious limitations — they were distributed across every node, causing fan-out queries that hit all nodes. SAI is a completely new indexing architecture built directly into Cassandra's storage layer.

**Why SAI is better**:
- Stored alongside the SSTable data files (hence "storage-attached")
- Efficient on-disk format with low write amplification
- Supports filtering, range queries, and collection contains

**Without SAI**, querying by tag would require a separate table:
```cql
-- You'd need this denormalized table:
CREATE TABLE videos_by_tag (
    tag text,
    videoid uuid,
    ...
    PRIMARY KEY (tag, videoid)
);
-- AND keep it in sync on every write!
```

**With SAI**, you simply add an index to the existing table.

### SAI on Collection Types

A particularly powerful SAI feature is indexing **inside collections**. The `CONTAINS` predicate lets you search for videos where the `tags` set contains a specific value:

```cql
SELECT * FROM killrvideo.videos
WHERE tags CONTAINS 'cassandra';
```

The SAI index on `tags` efficiently answers this query — Cassandra does not scan all rows; it consults the index to find only matching rows.

## Data Model

### Table: `videos` (with SAI on tags)

```cql
CREATE TABLE killrvideo.videos (
    videoid                 uuid PRIMARY KEY,
    userid                  uuid,
    name                    text,
    description             text,
    location                text,
    preview_image_location  text,
    tags                    set<text>,
    added_date              timestamp,
    status                  text
);

-- SAI index on the tags collection column
CREATE CUSTOM INDEX videos_tags_idx
ON killrvideo.videos(tags)
USING 'StorageAttachedIndex';
```

**Why this works**: The `CREATE CUSTOM INDEX ... USING 'StorageAttachedIndex'` on a collection column creates an index that covers every element inside every row's set. Each tag value in every video becomes a searchable entry.

## Database Queries

### Query: Find Videos by Tag

**Equivalent CQL**:
```cql
SELECT videoid, name, preview_image_location, added_date, userid
FROM killrvideo.videos
WHERE tags CONTAINS 'cassandra'
  AND status = 'READY'
LIMIT 9
ALLOW FILTERING;
```

**Performance note**: The `ALLOW FILTERING` clause is required when combining SAI filters. With a well-built SAI index, this is still efficient — the index narrows candidates before the status filter is applied.

### Pagination with SAI

SAI supports cursor-based pagination through the Data API's `skip` and `limit` parameters:

```
Page 1: skip=0, limit=9  → items 1–9
Page 2: skip=9, limit=9  → items 10–18
Page 3: skip=18, limit=9 → items 19–27
```

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/by-tag/cassandra      │
│    ?page=1&pageSize=9                                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate path param and query params                  │
│    ├─ tag_name non-empty? → proceed                      │
│    └─ page/pageSize valid integers? → proceed            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Normalize tag to lowercase                            │
│    "Cassandra" → "cassandra"                             │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Query videos WHERE tags CONTAINS tag                  │
│    AND status = 'READY'                                  │
│    with skip=(page-1)*pageSize, limit=pageSize           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Assemble PaginatedResponse                            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Return 200 OK                                         │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Case Sensitivity

Tags are stored lowercase by convention. When a user uploads a video with tag "Cassandra", it is normalized to "cassandra" before storage. Querying for "Cassandra" vs "cassandra" could return different results if normalization is inconsistent — always normalize on both write and read.

### 2. Tag Cardinality

Tags like "music" or "tutorial" may match thousands of videos. Tags like "astra-db-vector-search-demo-2025" may match none. The SAI index handles both cases efficiently, but be aware that very high-cardinality result sets require careful pagination.

### 3. Only READY Videos Are Shown

The query filters `status = 'READY'` to avoid showing PENDING or ERROR videos to the public. This requires a second SAI or combined filter — the `status` column should also be SAI-indexed for efficient combined filtering.

```cql
CREATE CUSTOM INDEX videos_status_idx
ON killrvideo.videos(status)
USING 'StorageAttachedIndex';
```

### 4. Tag Autocomplete Is a Separate Endpoint

This endpoint requires exact tag matches. For type-ahead suggestions while the user types, see [GET /api/v1/search/tags/suggest](/services/search/get-tags-suggest/).

### 5. SAI vs. Full-Text Search

SAI's `CONTAINS` performs **exact match** on set elements. It does NOT do substring matching. "cass" would not match "cassandra". For partial text search, the tags suggest endpoint uses a different technique.

## Developer Tips

### Common Pitfalls

1. **Case mismatch**: "NoSQL" in the request path won't find videos tagged "nosql". Always normalize.

2. **URL encoding**: Tags with spaces or special characters must be URL-encoded. "data science" becomes `data%20science` in the path.

3. **Combining too many filters without indexes**: If you add more filter predicates (e.g., also filter by date range), ensure each column has an index or the query degrades to a table scan.

4. **Forgetting the status filter**: Without filtering to READY, users see videos that are still being processed.

### Best Practices

1. **Normalize tags at write time**: Enforce lowercase, trim whitespace, strip special characters.

2. **Limit tag length**: Enforce a max length (e.g., 32 characters) to prevent abuse.

3. **Cap the tag count per video**: e.g., maximum 10 tags per video. This bounds the set size and prevents gaming the search index.

4. **Pre-populate popular tags**: Consider a tag popularity counter so the UI can display "most used tags."

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| Common tag (many matches) | 5–15ms | SAI narrows efficiently |
| Rare tag (few matches) | 5–10ms | SAI still fast |
| No matches | < 5ms | Empty result set fast |

### Related Endpoints

- [GET /api/v1/search/tags/suggest](/services/search/get-tags-suggest/) - Autocomplete for tag names
- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Full details for a single video
- [PUT /api/v1/videos/{id}](/services/video-catalog/put-video/) - Update tags on an existing video

## Further Learning

- [SAI Documentation (DataStax)](https://docs.datastax.com/en/astra-db-serverless/databases/use-sai-indexes.html)
- [Cassandra Collection Types](https://docs.datastax.com/en/cql-oss/3.x/cql/cql_using/useCollections.html)
- [Indexing Collections with SAI](https://docs.datastax.com/en/astra-db-serverless/databases/sai-overview.html)
