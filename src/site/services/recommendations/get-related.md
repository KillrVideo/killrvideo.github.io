---
title: "GET /api/v1/videos/{video_id}/related"
description: "Get videos related to a specific video using content similarity"
endpoint: "/api/v1/videos/{video_id}/related"
method: "GET"
spec_artifact: "/services/recommendations/_specs/get-related.spec.md"
concepts:
  - content-based-filtering
  - vector-similarity
  - ann-search
  - stub-implementation
order: 4
draft: true
---

# GET /api/v1/videos/{video_id}/related - Related Videos

## Overview

This endpoint returns a list of videos that are semantically similar to a given video. The intended implementation uses content-based filtering: retrieve the source video's embedding vector, then find other videos whose vectors are closest to it via an Approximate Nearest Neighbor (ANN) search.

**Current implementation note**: This endpoint is currently **stubbed**. It returns the most recently added videos with randomized similarity scores rather than genuine vector similarity results. The stub allows UI development and integration testing to proceed before the full recommendation pipeline is operational.

**Why it exists**: "Related videos" is a fundamental engagement feature. Showing similar content after a video ends keeps viewers on the platform and helps surface content they may not have discovered otherwise.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/videos/{video_id}/related`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_id` | UUID | The source video to find related content for |

### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 5 | 20 | Number of related videos to return |

### Response Body

```json
[
  {
    "videoId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Advanced Cassandra Data Modeling Techniques",
    "thumbnailUrl": "https://cdn.killrvideo.com/thumbs/a1b2c3d4.jpg",
    "score": 0.94
  },
  {
    "videoId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "title": "CQL Tutorial: Clustering Keys Deep Dive",
    "thumbnailUrl": "https://cdn.killrvideo.com/thumbs/b2c3d4e5.jpg",
    "score": 0.87
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | UUID | Related video identifier |
| `title` | string | Video title |
| `thumbnailUrl` | string | Thumbnail image URL |
| `score` | float | Similarity score (0.0–1.0; higher = more similar) |

**Note on current stub**: Scores are randomly generated. In the full implementation, `score` represents the cosine similarity between the source video's `content_features` vector and the candidate video's vector.

## Cassandra Concepts Explained

### Content-Based Filtering

Content-based filtering recommends items similar to a source item, based on the item's own attributes rather than on user behavior. For videos:

- **Collaborative filtering** (not used here): "Users who watched X also watched Y"
- **Content-based filtering** (this endpoint): "Video Y has similar content features to video X"

Vector embeddings make content-based filtering powerful: instead of manually defining similarity rules (same tags, same author, etc.), an ML model encodes the semantic meaning of video metadata into a vector. Similar videos end up near each other in vector space automatically.

### From Source Vector to Related Videos

The full implementation workflow:

1. **Fetch source video's vector**: Read `content_features` from the source video's row
2. **Query ANN index**: Use the source vector as the query vector in an ANN search
3. **Exclude the source video**: The source video will always be its own nearest neighbor — filter it out
4. **Return top N results**: Apply the `limit` parameter

```cql
-- Step 1: Get source video's vector
SELECT content_features FROM killrvideo.videos WHERE videoid = ?;

-- Step 2: Find similar videos
SELECT videoid, name, thumbnail_url, similarity_score(content_features, ?)
FROM killrvideo.videos
ORDER BY content_features ANN OF <source_vector>
LIMIT 21;  -- limit+1 to account for excluding the source video itself
```

### Similarity Score Semantics

The `score` field in the response represents **cosine similarity** between the two vectors:

- **1.0**: Identical vectors (videos are essentially the same topic)
- **0.7–0.9**: Highly similar content (strongly recommended)
- **0.4–0.6**: Moderately related content (same general domain)
- **0.0–0.3**: Weakly related (may not be useful recommendations)
- **Negative values**: Possible with cosine similarity but rare in practice for video embeddings

In the stub implementation, these scores are random floats and have no semantic meaning.

### Why a Stub is Acceptable Here

The stub returns plausible-looking data (real videos, believable score format) without requiring the ML pipeline to be operational. This pattern is useful when:
- The data pipeline is still being built
- The UI team needs to develop recommendation surfaces
- Performance testing needs representative data shapes

The stub must be clearly documented and have a clear migration path to the real implementation. This documentation serves that purpose.

## Data Model

### Table: `videos` (full implementation)

```cql
CREATE TABLE killrvideo.videos (
    videoid         uuid PRIMARY KEY,
    userid          uuid,
    name            text,
    description     text,
    tags            set<text>,
    thumbnail_url   text,
    added_date      timestamp,
    content_features vector<float, 1536>
);

CREATE CUSTOM INDEX videos_content_features_idx
ON killrvideo.videos(content_features)
USING 'StorageAttachedIndex';
```

### Stub Implementation Query

The current stub queries `videos` ordered by `added_date` (most recent first):

```python
async def get_related_videos_stub(video_id: UUID, limit: int):
    videos_table = await get_table("videos")
    results = await videos_table.find(
        filter={},  # No filter — just get recent videos
        sort={"added_date": -1},
        limit=limit + 1  # Fetch one extra in case source video appears
    )
    # Exclude the source video if present
    results = [v for v in results if v["videoid"] != str(video_id)][:limit]

    # Add random scores for UI compatibility
    import random
    return [
        {
            "videoId": v["videoid"],
            "title": v["name"],
            "thumbnailUrl": v.get("thumbnail_url", ""),
            "score": round(random.uniform(0.5, 0.99), 2)
        }
        for v in results
    ]
```

## Database Queries

### Full Implementation (intended)

#### Step 1: Fetch Source Video Vector

```python
async def get_video_vector(video_id: UUID) -> list[float] | None:
    table = await get_table("videos")
    row = await table.find_one(
        filter={"videoid": str(video_id)},
        projection={"content_features": 1}
    )
    return row["content_features"] if row else None
```

**Equivalent CQL**:
```cql
SELECT content_features FROM killrvideo.videos WHERE videoid = ?;
```

#### Step 2: ANN Search for Similar Videos

```python
async def find_related_by_vector(
    source_vector: list[float],
    source_id: UUID,
    limit: int
) -> list[dict]:
    table = await get_table("videos")
    results = await table.find(
        sort={"content_features": {"$vector": source_vector}},
        limit=limit + 1,
        projection={"videoid": 1, "name": 1, "thumbnail_url": 1}
    )
    # Filter out the source video
    return [r for r in results if r["videoid"] != str(source_id)][:limit]
```

**Equivalent CQL**:
```cql
SELECT videoid, name, thumbnail_url,
       similarity_cosine(content_features, ?) AS score
FROM killrvideo.videos
ORDER BY content_features ANN OF ?
LIMIT 21;
```

## Implementation Flow

### Current (Stub)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/{video_id}/related    │
│    ?limit=5                                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validate video_id (UUID), validate limit (1–20)       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. [STUB] Fetch most recent videos from videos table     │
│    Exclude source video_id from results                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. [STUB] Assign random score to each result             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Return 200 OK — array of RecommendationItem           │
└─────────────────────────────────────────────────────────┘
```

### Intended (Full Vector Implementation)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/videos/{video_id}/related    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Validate params                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Fetch content_features for source video               │
│    └─ If null or video not found: return [] or 404       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. ANN search: ORDER BY content_features ANN OF <vector> │
│    LIMIT limit+1                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Filter out source video from results                  │
│    Trim to requested limit                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 200 OK — array of RecommendationItem with      │
│    real cosine similarity scores                         │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. This Endpoint is Currently Stubbed

**This is the most important note for this endpoint.** The scores returned are random; the videos returned are simply the most recent, not the most similar. Do not rely on this endpoint for accurate recommendations in production until the stub is replaced with the vector implementation.

**How to tell if you are running the stub**: If all related videos have scores that change on each request, the stub is active.

### 2. Limit Cap at 20

The `limit` parameter has a maximum of 20. Requesting more than 20 related videos should return a 422 validation error. ANN searches are fast but not free — uncapped limits would allow clients to issue very expensive queries.

### 3. Videos Without Embeddings

In the full vector implementation, if the source video has no `content_features` (embedding not yet ingested), the endpoint has two reasonable behaviors:
- Return an empty array with a 200 status
- Fall back to returning recent videos (same as the stub)

The stub implicitly uses the fallback approach for all videos.

### 4. Source Video Excluded from Results

The source video will always be the nearest neighbor to itself (identical vector). It must be filtered out of results before returning. This requires fetching `limit + 1` results from the ANN query to ensure the response contains the full requested count even after filtering.

### 5. Migration Path from Stub to Full Implementation

When the embedding pipeline is operational and vectors are ingested for a sufficient number of videos, replace the stub query with the vector ANN query. The response schema does not change — only the data quality improves. A/B testing the change is straightforward because the endpoint signature is identical.

## Developer Tips

### Common Pitfalls

1. **Not excluding the source video**: The source video is always its own best match. Forgetting to filter it produces a results list where the first item is the video the user is already watching.

2. **Ignoring the stub status**: Building dependent features (recommendation carousels, "up next" queues) on top of the stub without awareness that the data is random leads to poor UX when the stub is replaced.

3. **Not handling the case where a video has no embedding**: In the full implementation, a video may exist but have `content_features = null`. The service must handle this gracefully.

4. **Requesting too many results**: The limit cap exists for a reason. Requesting 100 related videos in a tight loop would degrade database performance significantly.

### Query Performance Expectations

| Implementation | Operation | Performance |
|---------------|-----------|-------------|
| Stub | Fetch recent videos | **< 15ms** |
| Full | Fetch source vector | **< 5ms** |
| Full | ANN search | **< 50ms** |
| Full | Total | **< 60ms** |

### Testing Tips

```python
async def test_related_videos_returns_array():
    response = await client.get(
        f"/api/v1/videos/{video_id}/related?limit=5"
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 5

    for item in data:
        assert "videoId" in item
        assert "title" in item
        assert "score" in item
        assert item["videoId"] != str(video_id)  # Source excluded

async def test_related_limit_max():
    response = await client.get(
        f"/api/v1/videos/{video_id}/related?limit=21"
    )
    assert response.status_code == 422  # Exceeds max

async def test_related_is_public():
    # No auth header — should still work
    response = await client.get(f"/api/v1/videos/{video_id}/related")
    assert response.status_code == 200
```

## Related Endpoints

- [GET /api/v1/recommendations/foryou](/services/recommendations/get-for-you/) - Personalized recommendations (uses same vector index)
- [POST /api/v1/reco/ingest](/services/recommendations/post-ingest/) - Populates the content_features vectors that power this endpoint

## Further Learning

- [Content-Based Filtering](https://developers.google.com/machine-learning/recommendation/content-based/basics)
- [Cosine Similarity](https://www.pinecone.io/learn/vector-similarity/)
- [Cassandra ANN Queries](https://docs.datastax.com/en/dse/6.9/dse-dev/datastax_enterprise/search/vectorSearch.html)
- [HNSW Graph Algorithm](https://arxiv.org/abs/1603.09320)
