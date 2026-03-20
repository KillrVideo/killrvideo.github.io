---
title: "POST /api/v1/reco/ingest"
description: "Ingest a video embedding vector for recommendation use"
endpoint: "/api/v1/reco/ingest"
method: "POST"
spec_artifact: "/services/recommendations/_specs/post-ingest.spec.md"
concepts:
  - vector-embeddings
  - embedding-storage
  - ml-pipeline-integration
  - content-features
order: 3
draft: true
---

# POST /api/v1/reco/ingest - Ingest Video Embedding

## Overview

This endpoint accepts a video ID and a pre-computed embedding vector, then stores the vector in the `content_features` column of the `videos` table. The stored vector powers the ANN similarity searches used by the For You and Related Videos recommendation endpoints.

This is a data pipeline endpoint, not a user-facing endpoint. It is called by content processing pipelines after a video is added — the pipeline generates an embedding from the video's metadata and then calls this endpoint to persist it.

**Why it exists**: Generating embeddings is computationally expensive and typically done asynchronously (after upload). This endpoint decouples the embedding computation from video creation, allowing the ML pipeline to push vectors into the database whenever they are ready.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/reco/ingest`
- **Auth Required**: Yes — creator role (JWT bearer token)
- **Success Status**: 202 Accepted

### Request Body

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "vector": [0.12, -0.45, 0.78, 0.03, -0.91, "...1536 total values..."]
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| `videoId` | UUID | Must reference an existing video |
| `vector` | float[] | Must match the dimensionality expected by the vector index |

### Response Body

```json
{
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "accepted",
  "message": "Embedding ingested successfully"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | UUID | The video that was updated |
| `status` | string | "accepted" on success, "failed" on error |
| `message` | string | Optional human-readable status detail |

## Cassandra Concepts Explained

### Vector Data Type

Cassandra 5.0 introduces the `vector` data type for storing fixed-length arrays of floating-point numbers. The type declaration includes the dimensionality:

```cql
content_features vector<float, 1536>
```

This means the column stores exactly 1,536 single-precision floats (about 6KB per row). Attempting to insert a vector of a different length will produce a type error.

**Why this dimensionality?** 1,536 dimensions is the output size of OpenAI's `text-embedding-3-small` model, a common choice for text/metadata embeddings. Different embedding models produce different dimensionalities — the schema must match the model.

### Updating a Single Column (Column-Level Updates)

Cassandra's INSERT and UPDATE operations work at the column level, not the row level. Updating only `content_features` leaves all other video columns unchanged:

```cql
-- Only updates content_features; all other columns remain as-is
UPDATE killrvideo.videos
SET content_features = [0.12, -0.45, 0.78, ...]
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

This is a key advantage over document databases that require rewriting the entire document. In Cassandra, column-level updates are atomic and targeted.

### Storage-Attached Index for Vector Search

Storing a vector column without an index only allows exact equality queries (not useful for similarity search). To enable ANN queries, a SAI vector index must exist:

```cql
CREATE CUSTOM INDEX videos_content_features_idx
ON killrvideo.videos(content_features)
USING 'StorageAttachedIndex';
```

Once this index exists, the following becomes possible:

```cql
SELECT videoid FROM killrvideo.videos
ORDER BY content_features ANN OF [0.12, -0.45, 0.78, ...]
LIMIT 10;
```

The ingest endpoint updates the indexed column. Cassandra automatically updates the SAI index as part of the write — no manual index maintenance is needed.

### Why 202 Accepted (Not 201 Created)?

HTTP 202 means "I received your request and it is being processed, but the result is not immediately available." This is appropriate here because:

- The vector is written to Cassandra immediately, but
- The SAI index update may propagate asynchronously
- Queries against the new vector may take a moment to reflect the update

By returning 202, the API accurately communicates that the data was accepted but results may not be immediately visible in recommendation queries.

### ML Pipeline Integration Pattern

Embedding ingestion follows a common ML pipeline pattern:

```
Video Created → Metadata Extracted → Embedding Model → POST /reco/ingest → Cassandra
```

1. **Video Created**: User uploads video via `/api/v1/videos`
2. **Metadata Extracted**: Title, description, and tags are extracted
3. **Embedding Model**: An ML model (e.g., OpenAI API) converts metadata to a vector
4. **POST /reco/ingest**: The vector is stored in Cassandra
5. **Cassandra**: SAI index updated; video is now searchable by similarity

This decoupled approach allows:
- The embedding step to use any ML model
- Batch re-embedding when switching models
- Failure recovery (re-run just the embedding step without touching video metadata)

## Data Model

### Table: `videos` (relevant columns for embedding)

```cql
CREATE TABLE killrvideo.videos (
    videoid         uuid PRIMARY KEY,
    userid          uuid,
    name            text,
    description     text,
    tags            set<text>,
    thumbnail_url   text,
    added_date      timestamp,
    preview_image_location text,
    content_features vector<float, 1536>
);

-- Required for ANN similarity search
CREATE CUSTOM INDEX videos_content_features_idx
ON killrvideo.videos(content_features)
USING 'StorageAttachedIndex';
```

**This endpoint only writes to `content_features`**. All other video metadata is untouched.

## Database Queries

### 1. Validate Video Exists

```python
async def video_exists(video_id: UUID) -> bool:
    videos_table = await get_table("videos")
    row = await videos_table.find_one(
        filter={"videoid": str(video_id)},
        projection={"videoid": 1}
    )
    return row is not None
```

**Equivalent CQL**:
```cql
SELECT videoid FROM killrvideo.videos WHERE videoid = ?;
```

**Performance**: O(1) — partition key lookup.

### 2. Update content_features Column

```python
async def store_embedding(video_id: UUID, vector: list[float]):
    videos_table = await get_table("videos")
    await videos_table.find_one_and_update(
        filter={"videoid": str(video_id)},
        update={"$set": {"content_features": vector}}
    )
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.videos
SET content_features = [0.12, -0.45, 0.78, ...]
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Performance**: O(1) — single partition write. The SAI index update is handled automatically by Cassandra.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Pipeline calls POST /api/v1/reco/ingest               │
│    Header: Authorization: Bearer <creator_jwt>           │
│    Body: { videoId, vector: [float, ...] }               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. JWT middleware validates creator role                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate request body                                 │
│    ├─ videoId: valid UUID                                │
│    └─ vector: non-empty float array                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Verify video exists in videos table                   │
│    └─ 404 if video not found                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. UPDATE videos SET content_features = ?                │
│    WHERE videoid = ?                                     │
│    (SAI index updated automatically)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 202 Accepted                                   │
│    { videoId, status: "accepted", message }              │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Idempotent by Design

Calling this endpoint multiple times with the same `videoId` and a new vector simply overwrites the previous value. The last write wins. This makes the pipeline safely retryable without side effects.

### 2. Dimension Enforcement

The `vector<float, 1536>` schema type enforces a fixed vector length. If the pipeline sends a vector of a different size, Cassandra will reject the write with a type error. The API layer should validate the vector length before attempting the database write and return a clear 422 with the expected dimensionality.

### 3. Model Versioning and Re-ingestion

When the embedding model is upgraded (producing vectors of a different dimensionality or semantics), all existing vectors must be regenerated. This endpoint supports that migration: call it for every video with the new vector. The old `content_features` value is overwritten. However, you cannot query by both old and new vectors simultaneously — plan the migration as a bulk replacement, not a gradual rollout.

### 4. Creator Role Restriction

This endpoint is restricted to creator-role tokens to prevent unauthorized manipulation of recommendation data. In a production deployment, the pipeline service would use a service account token rather than a user's personal token.

### 5. No Notification to Downstream Services

This endpoint only updates Cassandra. If recommendation caches or user preference models need to be invalidated when a new embedding is ingested, that must be handled by the calling pipeline, not this endpoint.

## Developer Tips

### Common Pitfalls

1. **Wrong vector dimensionality**: Validate the vector length before calling this endpoint. A mismatch causes a hard error from Cassandra, not a soft failure.

2. **Calling this endpoint before the video exists**: The video must be created via the video catalog service first. Attempting to set `content_features` for a non-existent video will either silently do nothing (if using INSERT/upsert) or return a 404 (if the service validates existence first).

3. **Using this for user preference vectors**: This endpoint only handles video embeddings. User preference vectors have a different storage mechanism.

4. **Blocking video display on embedding availability**: The video catalog should show videos even before their embedding is available. A missing `content_features` means the video won't appear in ANN search results but does not mean the video is broken.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Video existence check | **< 5ms** | Partition key lookup |
| Update content_features | **< 15ms** | Single partition write + index update |
| Total | **< 25ms** | Two sequential operations |

### Testing Tips

```python
async def test_ingest_embedding():
    vector = [0.1] * 1536  # Valid 1536-dimensional vector

    response = await client.post(
        "/api/v1/reco/ingest",
        json={"videoId": str(video_id), "vector": vector},
        headers={"Authorization": f"Bearer {creator_token}"}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "accepted"

async def test_ingest_wrong_dimensions():
    short_vector = [0.1] * 100  # Wrong dimensionality

    response = await client.post(
        "/api/v1/reco/ingest",
        json={"videoId": str(video_id), "vector": short_vector},
        headers={"Authorization": f"Bearer {creator_token}"}
    )
    assert response.status_code == 422

async def test_ingest_requires_creator_role():
    response = await client.post(
        "/api/v1/reco/ingest",
        json={"videoId": str(video_id), "vector": [0.1] * 1536},
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert response.status_code == 403
```

## Related Endpoints

- [GET /api/v1/recommendations/foryou](/services/recommendations/get-for-you/) - Consumes ingested vectors for personalization
- [GET /api/v1/videos/{video_id}/related](/services/recommendations/get-related/) - Also uses content_features vectors

## Further Learning

- [Cassandra Vector Data Type](https://docs.datastax.com/en/dse/6.9/dse-dev/datastax_enterprise/search/vectorSearch.html)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Vector Index in Astra](https://docs.datastax.com/en/astra-serverless/docs/develop/vector-search.html)
- [ML Pipeline Patterns](https://www.tensorflow.org/tfx/guide/understanding_tfx_pipelines)
