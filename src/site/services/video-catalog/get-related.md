---
title: "GET /api/v1/videos/id/{video_id}/related"
description: "Get content-based video recommendations using vector similarity search"
endpoint: "/api/v1/videos/id/{video_id}/related"
method: "GET"
spec_artifact: "/services/video-catalog/_specs/get-related.spec.md"
concepts:
  - vector-similarity-search
  - content-based-recommendations
  - embeddings
  - ann-approximate-nearest-neighbor
  - stub-vs-production
order: 13
draft: true
---

# GET /api/v1/videos/id/{video_id}/related - Related Videos

## Overview

This endpoint returns a list of videos that are similar to the given video, ranked by relevance. It is powered by **vector similarity search** — Astra DB's built-in capability for finding semantically similar content using machine learning embeddings.

**Why it exists**: After watching a video, users want to explore related content. Tag-based browsing is limited to exact matches; vector similarity finds thematically related content even when different words are used.

**Current state**: This endpoint may be partially stubbed in the reference implementation — it returns placeholder or tag-based results rather than true vector embeddings. The documentation describes the full production design as a learning resource.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/id/{video_id}/related`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The source video to find similar content for |

### Query Parameters

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| `limit` | integer | 5 | Maximum 20 |

### Request

```http
GET /api/v1/videos/id/550e8400-e29b-41d4-a716-446655440000/related?limit=5
```

### Response Body

```json
[
  {
    "videoId": "661f9511-f3ac-52e5-b827-557766551111",
    "title": "Cassandra Data Modeling Patterns",
    "thumbnailUrl": "https://img.youtube.com/vi/xyz789/mqdefault.jpg",
    "score": 0.94
  },
  {
    "videoId": "772g0622-g4bd-63f6-c938-668877662222",
    "title": "NoSQL vs. SQL: When to Choose What",
    "thumbnailUrl": "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    "score": 0.87
  }
]
```

| Field | Description |
|-------|-------------|
| `videoId` | UUID of the related video |
| `title` | Video title |
| `thumbnailUrl` | Preview image URL |
| `score` | Similarity score (0.0 to 1.0, higher = more similar) |

## Cassandra Concepts Explained

### What Are Vector Embeddings?

A **vector embedding** is a list of floating-point numbers that encodes the semantic meaning of a piece of content. Conceptually:

```
"Introduction to Apache Cassandra"  → [0.12, -0.45, 0.78, 0.33, ...]  (1536 numbers)
"Cassandra Data Modeling Patterns"  → [0.11, -0.43, 0.79, 0.35, ...]  (similar!)
"How to Bake Sourdough Bread"       → [0.88,  0.21, -0.12, 0.95, ...]  (very different!)
```

Videos about similar topics have vectors that point in similar directions in high-dimensional space. Finding related videos means finding vectors that are close together — this is the **nearest neighbor** problem.

### Vector Search in Astra DB

Astra DB (powered by Cassandra 5.0) supports native vector search through `VECTOR` column types and `ORDER BY ... ANN OF` syntax:

```cql
-- Store video embeddings
CREATE TABLE killrvideo.video_vectors (
    videoid   uuid PRIMARY KEY,
    embedding vector<float, 1536>  -- 1536-dimensional embedding
);

CREATE CUSTOM INDEX video_vector_idx
ON killrvideo.video_vectors(embedding)
USING 'StorageAttachedIndex'
WITH OPTIONS = {'similarity_function': 'cosine'};
```

To find related videos:
```cql
-- Find the 5 most similar videos to the source video's embedding
SELECT videoid, similarity_cosine(embedding, ?) as score
FROM killrvideo.video_vectors
ORDER BY embedding ANN OF ?   -- ANN = Approximate Nearest Neighbor
LIMIT 5;
```

### ANN: Approximate Nearest Neighbor

**Exact** nearest neighbor search in high-dimensional space is computationally expensive — you would need to compute distance to every vector in the table. **ANN** (Approximate Nearest Neighbor) uses index structures (like HNSW — Hierarchical Navigable Small World graphs) to find the nearest neighbors very efficiently, with a small tradeoff in accuracy.

For recommendations, approximate is sufficient:
- Finding the 95th-most-similar video instead of the 99th makes no practical difference
- The ANN search completes in milliseconds instead of seconds

### Cosine Similarity

The similarity metric used is **cosine similarity** — the cosine of the angle between two vectors:
- Score of 1.0 = identical direction (identical semantic meaning)
- Score of 0.0 = orthogonal (completely unrelated)
- Score of -1.0 = opposite (antonyms, conceptual opposites)

For video recommendations, any score above 0.7 typically indicates strong topical similarity.

### Content-Based vs. Collaborative Filtering

**Content-based** (this endpoint): Finds similar videos based on their content (title, description, tags). Does not require user behavior data. Works for new videos with no view history.

**Collaborative filtering**: Finds videos that users who watched video A also watched. Requires interaction data. Cannot work for new videos.

A production recommendation system combines both signals.

## Data Model

### Table: `video_vectors`

```cql
CREATE TABLE killrvideo.video_vectors (
    videoid   uuid PRIMARY KEY,
    embedding vector<float, 1536>,   -- OpenAI ada-002 embedding dimension
    name      text,                   -- Denormalized for display
    preview_image_location text,      -- Denormalized for display
    added_date timestamp
);

CREATE CUSTOM INDEX video_vector_idx
ON killrvideo.video_vectors(embedding)
USING 'StorageAttachedIndex'
WITH OPTIONS = {'similarity_function': 'cosine'};
```

### How Embeddings Get Populated

When a video reaches READY status, a background job:
1. Concatenates the video's title, description, and tags into a text string
2. Sends the text to an embedding API (e.g., OpenAI, HuggingFace)
3. Stores the returned vector in `video_vectors`

```python
text = f"{video.name} {video.description} {' '.join(video.tags)}"
embedding = await openai.embeddings.create(input=text, model="text-embedding-ada-002")
await vector_table.insert_one({
    "videoid": video.videoid,
    "embedding": embedding.data[0].embedding,
    "name": video.name,
    "preview_image_location": video.preview_image_location
})
```

## Database Queries

### Find Similar Videos

**Step 1**: Fetch the source video's embedding
```cql
SELECT embedding FROM killrvideo.video_vectors
WHERE videoid = 550e8400-e29b-41d4-a716-446655440000;
```

**Step 2**: Find nearest neighbors
```cql
SELECT videoid, name, preview_image_location,
       similarity_cosine(embedding, ?) as score
FROM killrvideo.video_vectors
ORDER BY embedding ANN OF ?
LIMIT 6;   -- Request 6 to exclude the source video itself
```

**Step 3**: Filter out the source video and apply limit

## Implementation Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/id/{id}/related       │
│    ?limit=5                                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Validate video_id UUID and limit                      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Fetch source video's embedding vector                 │
│    SELECT embedding FROM video_vectors WHERE videoid = ? │
│    ├─ No embedding? → Fall back to tag-based approach    │
│    └─ Found? → Continue with vector search               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. ANN search: ORDER BY embedding ANN OF <source_vector> │
│    LIMIT limit+1 (to exclude source video)               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Filter out source video, trim to limit                │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 6. Return 200 OK with array of RecommendationItem        │
└──────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Stub vs. Production

The KillrVideo reference implementation may return results from a simpler approach (e.g., videos sharing the same tags) rather than true vector similarity. The vector search design documented here represents the production-ready approach that you would implement as an exercise.

### 2. Cold Start Problem

A newly submitted video has no embedding (the enrichment job hasn't run yet). The fallback for this case is to return videos sharing the most tags. This gracefully degrades quality without failing.

### 3. Source Video Is Excluded

The source video itself is the most similar to itself (score = 1.0). It must be filtered from the results. Request `limit + 1` from the ANN search, then remove the source video.

### 4. Score Threshold

Optionally, filter out results with a score below a minimum threshold (e.g., 0.6). A video about "cooking pasta" should not appear as a related video to "Cassandra data modeling" even if the platform has very few videos.

### 5. Embedding Staleness

If a video's title or description is updated via [PUT /api/v1/videos/{id}](/services/video-catalog/put-video/), its embedding may become stale. A production system would re-generate the embedding after significant metadata changes.

## Developer Tips

### Common Pitfalls

1. **Returning the source video itself**: Always exclude the queried video from results.

2. **Not handling missing embeddings**: Videos without embeddings (still processing) should fall back to a tag-based approach, not return an error.

3. **No score threshold**: Without a minimum score filter, low-quality recommendations can slip through.

4. **Forgetting LIMIT+1**: If you need 5 results but must exclude the source, fetch 6.

### Best Practices

1. **Generate embeddings asynchronously**: Never generate embeddings in the request path. Background job only.

2. **Cache recommendations aggressively**: For any given video, related videos change slowly. Cache with a 1-hour TTL.

3. **Provide a fallback**: Always have a tag-based fallback for videos without embeddings.

4. **Expose the score**: Return similarity scores so the client can filter or sort by confidence.

5. **Monitor embedding coverage**: Track what percentage of READY videos have embeddings. Alert when coverage drops.

### Performance Expectations

| Scenario | Latency | Notes |
|----------|---------|-------|
| ANN search (vector index) | 10–30ms | Efficient HNSW index |
| Tag-based fallback | 10–20ms | SAI query |
| Cache hit | < 1ms | Recommended for this endpoint |

### Related Endpoints

- [GET /api/v1/videos/{id}](/services/video-catalog/get-video-by-id/) - Source video details
- [GET /api/v1/videos/by-tag/{tag}](/services/video-catalog/get-by-tag/) - Tag-based discovery (simpler alternative)
- [GET /api/v1/videos/trending](/services/video-catalog/get-trending/) - Popularity-based discovery

## Further Learning

- [Astra DB Vector Search](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html)
- [Understanding Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Approximate Nearest Neighbor (ANN)](https://en.wikipedia.org/wiki/Nearest_neighbor_search#Approximate_nearest_neighbor)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
