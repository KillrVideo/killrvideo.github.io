---
title: "GET /api/v1/recommendations/foryou"
description: "Get personalized video recommendations for the authenticated user"
endpoint: "/api/v1/recommendations/foryou"
method: "GET"
spec_artifact: "/services/recommendations/_specs/get-for-you.spec.md"
concepts:
  - vector-similarity-search
  - ann-search
  - user-preference-modeling
  - vector-embeddings
order: 2
draft: true
---

# GET /api/v1/recommendations/foryou - Personalized Recommendations

## Overview

This endpoint returns a personalized list of video recommendations for the currently authenticated user. It works by representing both videos and the user's watch/interest history as high-dimensional vectors, then finding the videos whose vectors are most similar to the user's preference vector using an Approximate Nearest Neighbor (ANN) search in Cassandra.

**Why it exists**: Chronological or popularity-based feeds are easy to implement but poor at personalization. Vector similarity search lets the system surface videos that are semantically related to what a user has engaged with, without needing to hand-code similarity rules.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/recommendations/foryou`
- **Auth Required**: Yes — viewer role (JWT bearer token)
- **Success Status**: 200 OK

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `pageSize` | integer | 10 | Number of recommendations per page |

### Response Body

```json
{
  "items": [
    {
      "videoId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Introduction to Cassandra Data Modeling",
      "thumbnailUrl": "https://cdn.killrvideo.com/thumbs/550e8400.jpg",
      "description": "Learn the fundamentals of Cassandra table design",
      "tags": ["cassandra", "databases", "tutorial"],
      "addedDate": "2025-10-15T09:00:00Z",
      "userId": "7f3e1a2b-dead-beef-cafe-123456789abc"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

## Cassandra Concepts Explained

### Vector Embeddings

A **vector embedding** is a list of floating-point numbers that represents the semantic meaning of content in a high-dimensional space. For videos, the embedding might encode topics, style, pacing, and subject matter as coordinates in a 1,536-dimensional space (a common size for embedding models).

The key property of embeddings is that **semantically similar content has numerically similar vectors**. Two videos about Cassandra data modeling will have embeddings that are "close" to each other in vector space, even if they share no keywords.

How video embeddings are generated:
1. A machine learning model (e.g., OpenAI's text-embedding model) processes the video title, description, and tags
2. It outputs a fixed-length array of floats
3. This array is stored in the `content_features` column of the `videos` table

### Vector Similarity Search

Given a query vector (representing the user's preferences), a vector similarity search finds the stored vectors that are closest to it. "Closeness" is typically measured by:

- **Cosine similarity**: Angle between vectors (measures directional similarity, ignores magnitude)
- **Dot product**: Magnitude-weighted similarity
- **Euclidean distance**: Straight-line distance in vector space

Cassandra 5.0 supports vector search natively with the `ANN OF` syntax:

```cql
SELECT videoid, title, thumbnail_url
FROM killrvideo.videos
ORDER BY content_features ANN OF [0.12, -0.45, 0.78, ...]
LIMIT 10;
```

This returns the 10 videos whose `content_features` vectors are most similar to the provided query vector.

### Approximate Nearest Neighbor (ANN) Search

"Exact" nearest neighbor search requires comparing the query vector against every stored vector — O(n) per query, impractical for large datasets.

**ANN** algorithms trade a small amount of accuracy for dramatically better performance. They use data structures like **HNSW** (Hierarchical Navigable Small World graphs) to organize vectors so that similar ones cluster together. A search then explores only a fraction of the total vectors.

Cassandra's vector search uses HNSW internally:
- Typical recall: > 95% (finds most of the true nearest neighbors)
- Query time: O(log n) rather than O(n)
- Suitable for real-time recommendation at scale

### User Preference Modeling

To generate personalized recommendations, the system needs a vector that represents the user's preferences. Several approaches exist:

1. **Average of watched video vectors**: Sum the `content_features` vectors of videos the user has viewed, then normalize. Simple and effective.
2. **Weighted average**: Give recent views more weight than older ones.
3. **Dedicated user embedding**: Train a model that learns user preference vectors directly.

The service retrieves the user's preference vector (however it was computed) and uses it as the ANN query vector.

## Data Model

### Table: `videos` (relevant columns)

```cql
CREATE TABLE killrvideo.videos (
    videoid         uuid PRIMARY KEY,
    userid          uuid,
    name            text,
    description     text,
    tags            set<text>,
    thumbnail_url   text,
    added_date      timestamp,
    content_features vector<float, 1536>  -- The embedding vector
);

-- Vector index required for ANN search
CREATE CUSTOM INDEX videos_content_features_idx
ON killrvideo.videos(content_features)
USING 'StorageAttachedIndex';
```

**Key detail**: The `content_features` column stores the video's semantic embedding. Without the SAI vector index, you cannot perform ANN queries on this column.

### User Preference Vector

The user preference vector is not stored in a separate Cassandra table for this endpoint — it is derived or retrieved from a user profile service or computed from the user's watch history. The exact storage is implementation-specific, but the result is a `float[]` of the same dimensionality as `content_features`.

## Database Queries

### 1. Retrieve User Preference Vector

```python
async def get_user_preference_vector(user_id: UUID) -> list[float]:
    # Retrieve pre-computed preference vector for the user
    # This might come from a user_preferences table or be computed on the fly
    prefs_table = await get_table("user_preferences")
    row = await prefs_table.find_one(filter={"userid": str(user_id)})
    return row["preference_vector"] if row else None
```

### 2. ANN Vector Search on Videos

```python
async def find_similar_videos(
    preference_vector: list[float],
    limit: int
) -> list[dict]:
    videos_table = await get_table("videos")
    results = await videos_table.find(
        sort={"content_features": {"$vector": preference_vector}},
        limit=limit,
        projection={"videoid": 1, "name": 1, "thumbnail_url": 1,
                    "description": 1, "tags": 1, "added_date": 1, "userid": 1}
    )
    return results
```

**Equivalent CQL**:
```cql
SELECT videoid, name, thumbnail_url, description, tags, added_date, userid
FROM killrvideo.videos
ORDER BY content_features ANN OF [0.12, -0.45, 0.78, ...]
LIMIT 10;
```

**Performance**: Sub-100ms for typical datasets thanks to HNSW indexing. Exact performance depends on vector dimensionality and dataset size.

### 3. Exclude Already-Watched Videos (Optional)

For a better user experience, the service can filter out videos the user has already seen:

```python
watched_ids = await get_watched_video_ids(user_id)
recommendations = [r for r in raw_results if r["videoid"] not in watched_ids]
```

This filtering happens in the application layer because Cassandra's ANN query does not support complex post-filters natively.

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/recommendations/foryou       │
│    Header: Authorization: Bearer <jwt>                   │
│    ?page=1&pageSize=10                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. JWT middleware validates token, extracts userid       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Retrieve user preference vector                       │
│    ├─ Found: use as ANN query vector                     │
│    └─ Not found: fall back to popular/recent videos      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. ANN search: ORDER BY content_features ANN OF <vector> │
│    LIMIT pageSize * 2  (over-fetch for filtering)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Filter out already-watched videos (optional)          │
│    Apply pagination offset                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with PaginatedResponse                  │
│    { items (VideoSummary[]), total, page, pageSize }     │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Cold Start Problem

A new user has no watch history, so there is no preference vector. The system must handle this gracefully:
- Fall back to trending/popular videos
- Use demographic signals (if available) to seed recommendations
- Show onboarding content to build initial preferences

### 2. Vector Dimensionality Must Match

The preference vector and `content_features` column must have the same number of dimensions. If videos were ingested with 1,536-dimensional embeddings, the user preference vector must also be 1,536-dimensional. Dimension mismatch causes a query error.

### 3. ANN is Not Exact

The ANN search may occasionally miss videos that would technically be "closer" in vector space. The probability of missing a true nearest neighbor is low (typically < 5%) and the tradeoff for performance is worth it at scale.

### 4. Over-Fetching for Post-Processing

If the service filters results after the ANN query (e.g., removing watched videos), it should fetch more results than needed from Cassandra and then trim to `pageSize`. Fetching exactly `pageSize` results, then filtering, risks returning fewer items than requested.

### 5. Embedding Model Versioning

If the embedding model is upgraded (e.g., from 1,536 to 3,072 dimensions), all existing video vectors and user preference vectors must be regenerated with the new model before the ANN search will work correctly. Plan for this migration before changing models.

## Developer Tips

### Common Pitfalls

1. **Forgetting the vector SAI index**: ANN queries (`ORDER BY ... ANN OF`) require a Storage-Attached Index on the vector column. Without it, the query will fail or fall back to a full scan.

2. **Cold start with no preference vector**: Always implement a fallback for users who have not yet developed a preference profile.

3. **Returning videos the user already watched**: Without filtering, the top ANN results often include videos the user has already seen (high similarity because they've engaged with them). Always filter or deprioritize watched content.

4. **Dimension mismatch**: Ensure the user preference vector and video embedding vector always use the same model and dimensionality.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch user preference vector | **< 10ms** | Partition key lookup |
| ANN vector search | **< 50ms** | HNSW index traversal |
| Post-processing (filtering, pagination) | **< 5ms** | In-memory |
| Total | **< 65ms** | Dominated by vector search |

### Testing Tips

```python
async def test_foryou_requires_auth():
    response = await client.get("/api/v1/recommendations/foryou")
    assert response.status_code == 401

async def test_foryou_returns_video_items():
    response = await client.get(
        "/api/v1/recommendations/foryou",
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    for item in data["items"]:
        assert "videoId" in item
        assert "title" in item
```

## Related Endpoints

- [GET /api/v1/videos/{video_id}/related](/services/recommendations/get-related/) - Content-based related videos
- [POST /api/v1/reco/ingest](/services/recommendations/post-ingest/) - Ingest video embeddings that power this endpoint

## Further Learning

- [Cassandra Vector Search](https://docs.datastax.com/en/dse/6.9/dse-dev/datastax_enterprise/search/vectorSearch.html)
- [HNSW Algorithm Explained](https://www.pinecone.io/learn/hnsw/)
- [Vector Embeddings for Recommendations](https://www.tensorflow.org/recommenders)
- [Astra Data API Vector Search](https://docs.datastax.com/en/astra-serverless/docs/develop/dev-with-json.html)
