---
title: "GET /api/v1/search/videos"
description: "Search videos using semantic or keyword search"
endpoint: "/api/v1/search/videos"
method: "GET"
spec_artifact: "/services/search/_specs/get-search-videos.spec.md"
concepts:
  - vector-search
  - sai-indexes
  - nvidia-embeddings
  - similarity-scoring
order: 2
---

# GET /api/v1/search/videos - Video Search (Semantic & Keyword)

## Overview

This endpoint searches videos using either **semantic search** (AI-powered, meaning-based) or **keyword search** (traditional text matching). It demonstrates Astra DB's vector search capabilities with NVIDIA embeddings and Storage-Attached Indexes for text search.

**Why it exists**: Modern search needs go beyond exact keyword matching. Semantic search understands intent and meaning, enabling queries like "funny cat videos" to match videos titled "Hilarious Feline Compilation" even though they share no common words.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/search/videos`
- **Auth Required**: No (public endpoint)
- **Success Status**: 200 OK

### Request Parameters

```http
GET /api/v1/search/videos?query=python+tutorials&mode=semantic&page=1&pageSize=10
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search term (min 1 char) |
| `mode` | string | No | `keyword` | Search mode: `semantic` or `keyword` |
| `page` | integer | No | 1 | Page number (≥1) |
| `pageSize` | integer | No | 10 | Results per page (1-100) |

### Response Body

```json
{
  "data": [
    {
      "videoid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Advanced Python Tutorial",
      "description": "Learn advanced Python concepts",
      "preview_image_location": "https://...",
      "userid": "...",
      "added_date": "2025-10-31T10:00:00Z",
      "tags": ["python", "tutorial", "programming"],
      "$similarity": 0.87
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

Note: `$similarity` only appears in semantic mode results.

## Cassandra Concepts Explained

### What is Vector Search?

**Vector search** finds items based on semantic similarity rather than exact text matches.

**How it works**:

1. **Text → Numbers**: Convert text to a vector (array of numbers)
   ```
   "python tutorial" → [0.23, 0.87, -0.45, ..., 0.12]  # 4096 numbers
   ```

2. **Measure distance**: Calculate how similar two vectors are
   ```
   cosine_similarity(query_vector, video_vector) = 0.87  # 0-1 scale
   ```

3. **Rank by similarity**: Return results sorted by similarity score

**Example**:
```
Query: "learn coding"
Results:
  1. "Programming Tutorial" (similarity: 0.92)
  2. "Software Development Basics" (similarity: 0.89)
  3. "How to Code" (similarity: 0.85)
```

Notice: None match exactly, but all are semantically related!

### Vector Column in Cassandra

Cassandra 5.0 introduces the `vector` data type:

```cql
CREATE TABLE videos (
    videoid uuid PRIMARY KEY,
    name text,
    content_features vector<float, 4096>  -- 4096-dimensional vector
);
```

**What's stored**:
```json
{
  "videoid": "...",
  "name": "Python Tutorial",
  "content_features": [0.234, 0.876, -0.453, ..., 0.123]
}
```

**Size**: 4096 floats × 4 bytes = ~16 KB per video embedding

### Vectorize Feature (Astra DB)

**Problem**: How do we convert text to vectors?

**Traditional approach**: Run your own embedding model
```python
import openai
embedding = openai.embeddings.create(
    model="text-embedding-ada-002",
    input="Python tutorial"
)
```

**Astra approach**: Built-in `$vectorize` (automatic)
```python
# Just insert text, Astra handles embedding
await videos_table.insert_one({
    "videoid": video_id,
    "content_features": "Python tutorial for beginners"  # Text, not vector!
})
# Astra automatically converts to 4096-dim vector using NVIDIA model
```

**For search**:
```python
# Query with text, Astra embeds it automatically
results = videos_table.find(
    sort={"content_features": "learn python"}  # Text query
)
# Astra embeds "learn python" and finds similar vectors
```

**Benefits**:
- No need to run embedding models yourself
- Consistent embeddings (same model for all data)
- Lower latency (embeddings happen in-database)

### Vector Index with SAI

To enable fast vector search, create a SAI index:

```cql
CREATE CUSTOM INDEX videos_content_features_idx
ON videos(content_features)
USING 'StorageAttachedIndex'
WITH OPTIONS = {
  'similarity_function': 'COSINE',  -- How to measure similarity
  'source_model': 'nv-qa-4'         -- NVIDIA NV-Embed-QA model
};
```

**Index Properties**:
- **Similarity Function**: COSINE (others: EUCLIDEAN, DOT_PRODUCT)
- **Source Model**: `nv-qa-4` (NVIDIA NV-Embed-QA, 4096 dimensions)
- **Performance**: Approximate Nearest Neighbor (ANN) search, not exhaustive

### Keyword Search with SAI

For traditional text search, use SAI on text columns:

```cql
CREATE CUSTOM INDEX videos_name_idx
ON videos(name)
USING 'StorageAttachedIndex';
```

**Query**:
```python
results = videos_table.find(
    filter={"name": {"$regex": "python", "$options": "i"}}  # Case-insensitive
)
```

### Semantic vs Keyword Search

| Aspect | Semantic Search | Keyword Search |
|--------|-----------------|----------------|
| **Matching** | Meaning-based | Exact text |
| **Example Query** | "learn coding" | "python tutorial" |
| **Matches** | "Programming Basics", "Software Dev" | "Python Tutorial" only |
| **Technology** | Vector embeddings + ANN | Text index + regex |
| **Speed** | Slower (~50-200ms) | Faster (~10-50ms) |
| **Accuracy** | Better for natural language | Better for exact terms |
| **Storage** | +16KB per video | Minimal |

## Data Model

### Table: `videos`

```cql
CREATE TABLE killrvideo.videos (
    videoid uuid PRIMARY KEY,
    added_date timestamp,
    description text,
    name text,
    tags set<text>,
    content_features vector<float, 4096>,  -- For semantic search
    userid uuid,
    preview_image_location text
);

-- Vector search index
CREATE CUSTOM INDEX videos_content_features_idx
ON killrvideo.videos(content_features)
USING 'StorageAttachedIndex'
WITH OPTIONS = {
  'similarity_function': 'COSINE',
  'source_model': 'nv-qa-4'
};

-- Keyword search index
CREATE CUSTOM INDEX videos_name_idx
ON killrvideo.videos(name)
USING 'StorageAttachedIndex';
```

## Database Queries

### Mode Selection Logic

```python
use_semantic = (
    mode == "semantic" and
    settings.VECTOR_SEARCH_ENABLED  # Feature flag
)

if use_semantic:
    results = await search_videos_by_semantic(query, page, page_size)
else:
    results = await search_videos_by_keyword(query, page, page_size)
```

**Why a feature flag?**
- Vector search requires embeddings to be populated
- May be disabled for cost/performance reasons
- Allows A/B testing

### Query 1: Semantic Search

```python
async def semantic_search_with_threshold(
    db_table,
    vector_column="content_features",
    query="python tutorials",
    page=1,
    page_size=10,
    similarity_threshold=0.7,   # Min similarity score
    overfetch_factor=3          # Fetch 3x to allow filtering
):
    # Calculate how many docs to fetch
    overfetch = page_size * overfetch_factor * page

    # Vector search query
    cursor = db_table.find(
        filter={},                      # No WHERE clause (search all)
        sort={vector_column: query},    # Sort by similarity to query
        limit=overfetch,                # Fetch extra for filtering
        include_similarity=True         # Return $similarity score
    )

    docs = await cursor.to_list()

    # Client-side filtering by similarity threshold
    docs = [d for d in docs if d.get("$similarity", 0) >= similarity_threshold]

    # Paginate client-side
    start = (page - 1) * page_size
    end = start + page_size
    page_docs = docs[start:end]

    return page_docs, len(docs)
```

**What Astra does**:
1. Embeds query "python tutorials" using NVIDIA model → 4096-dim vector
2. Performs ANN search to find nearest neighbors
3. Returns results with `$similarity` score (0.0-1.0)

**Performance**: **~50-200ms** depending on dataset size

### Query 2: Keyword Search

```python
async def search_videos_by_keyword(query: str, page: int, page_size: int):
    videos_table = await get_table("videos")

    # Case-insensitive regex search on video name
    cursor = videos_table.find(
        filter={"name": {"$regex": query, "$options": "i"}},
        limit=page_size,
        skip=(page - 1) * page_size
    )

    docs = await cursor.to_list()
    return [VideoSummary.model_validate(d) for d in docs], len(docs)
```

**Actual Data API syntax**:
```json
{
  "find": {
    "filter": {"name": {"$regex": "python", "$options": "i"}},
    "options": {"limit": 10, "skip": 0}
  }
}
```

**Performance**: **~10-50ms** (faster than vector search)

## Implementation Flow

```
┌───────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/search/videos?               │
│    query=python&mode=semantic                            │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 2. Validate query parameters                             │
│    ├─ query too short? → 422 Validation Error            │
│    ├─ page/pageSize invalid? → 422                       │
│    └─ Valid? → Continue                                  │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 3. Determine search mode                                 │
│    mode == "semantic" AND VECTOR_SEARCH_ENABLED?         │
│    ├─ Yes → Use semantic_search_with_threshold()         │
│    └─ No → Use search_videos_by_keyword()                │
└────────────────────┬──────────────────────────────────────┘
                     │
                ┌────┴────┐
                │         │
                ▼         ▼
    ┌────────────────┐  ┌──────────────────┐
    │ SEMANTIC PATH  │  │  KEYWORD PATH    │
    └────────────────┘  └──────────────────┘
                │         │
                ▼         ▼
┌───────────────────────────────────────────────────────────┐
│ 4. Execute database query                                │
│                                                           │
│ SEMANTIC:                                                 │
│   find(sort={content_features: query},                   │
│        limit=overfetch, include_similarity=True)         │
│                                                           │
│ KEYWORD:                                                  │
│   find(filter={name: {$regex: query}},                   │
│        limit=pageSize, skip=offset)                      │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 5. Post-process results (semantic only)                  │
│    ├─ Filter by similarity_threshold (>=0.7)             │
│    ├─ Paginate client-side                               │
│    └─ Map to VideoSummary models                         │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 6. Build paginated response                              │
│    {data: [...], pagination: {page, totalItems, ...}}    │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│ 7. Return 200 OK with search results                     │
└───────────────────────────────────────────────────────────┘
```

**Semantic Search Queries**: 1 vector search

**Keyword Search Queries**: 1 text search

## Special Notes

### 1. The Overfetch Pattern

**Problem**: We want to filter by similarity threshold **and** paginate

**Naive approach** (doesn't work):
```python
# Can't filter by $similarity in the query itself
cursor = db_table.find(
    filter={"$similarity": {"$gte": 0.7}},  # Not supported
    sort={"content_features": query}
)
```

**Solution**: Overfetch + client-side filter
```python
# Fetch 3x the page size
cursor = db_table.find(
    sort={"content_features": query},
    limit=page_size * 3,  # Overfetch
    include_similarity=True
)

docs = await cursor.to_list()

# Filter client-side
docs = [d for d in docs if d["$similarity"] >= 0.7]

# Then paginate
page_docs = docs[start:end]
```

**Why overfetch by 3x?**
- With threshold=0.7, ~60-70% of results typically pass
- 3x gives us enough results after filtering
- Grows with page number (page 10 fetches more to account for earlier pages)

**Trade-off**: More data transferred, but necessary for filtering

### 2. Token Limit for Embeddings

**Limitation**: NVIDIA NV-Embed-QA has a 512-token limit

**What's a token?** Roughly 1 token ≈ 0.75 words

**Examples**:
- "Python tutorial" ≈ 2 tokens
- 300-word description ≈ 400 tokens
- 1000-word description ≈ 1333 tokens - Too long!

**Solution**: Clip text before embedding

```python
def clip_to_512_tokens(text: str) -> str:
    """Clip text to 512 tokens (rough estimate)."""
    # Rough estimate: 1 token ≈ 4 characters
    max_chars = 512 * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."
```

**Used during video submission**:
```python
content_text = f"{video.name} {video.description} {' '.join(video.tags)}"
clipped_text = clip_to_512_tokens(content_text)

await videos_table.insert_one({
    "content_features": clipped_text  # Safe to embed
})
```

### 3. Similarity Score Interpretation

**Scale**: 0.0 (completely different) to 1.0 (identical)

**Typical values**:
| Score | Interpretation | Action |
|-------|----------------|--------|
| 0.9-1.0 | Nearly identical | Perfect match |
| 0.7-0.9 | Highly relevant | Include in results |
| 0.5-0.7 | Somewhat related | Marginal |
| 0.0-0.5 | Unrelated | Filter out |

**Current threshold**: 0.7 (configurable in code)

**Tuning**:
- **Higher threshold** (0.8+): Fewer, more relevant results
- **Lower threshold** (0.5+): More results, some less relevant

### 4. Cold Start Problem

**Scenario**: New video just uploaded, no embedding yet

**Vector search behavior**:
```python
# Videos without embeddings won't appear in vector search
cursor = db_table.find(sort={"content_features": query})
# Only returns videos with populated content_features
```

**Solution**:
- Process embeddings during video submission (synchronous)
- OR ensure background job runs quickly
- OR fall back to keyword search for new videos

**Current implementation**: Embeddings created during submission (synchronous)

### 5. Cost Considerations

**Vector embeddings have costs**:

| Aspect | Cost |
|--------|------|
| **Storage** | ~16KB per video (4096 floats) |
| **Compute** | Embedding API calls (NVIDIA charges per call) |
| **Search** | ANN index maintenance |

**For 1 million videos**:
- Storage: 1M × 16KB = ~16GB of vector data
- Embedding cost: Depends on pricing model

**Optimization**:
- Only embed text up to 512 tokens (saves compute)
- Batch embedding operations
- Cache frequent queries
- Use keyword search for simple exact-match queries

## Developer Tips

### Common Pitfalls

1. **Forgetting token limits**: Clip text to 512 tokens before embedding

2. **Not handling empty results**: Vector search may return no results above threshold

3. **Overfetching too much**: Balance between filtering flexibility and performance

4. **Mixing search modes**: Don't combine vector + keyword in same query

5. **Ignoring similarity scores**: Threshold is crucial for result quality

### Best Practices

1. **Combine both search modes**:
   ```python
   # Try semantic first
   results = semantic_search(query)
   if len(results) < 5:
       # Fall back to keyword
       results += keyword_search(query)
   ```

2. **Tune similarity threshold** based on user feedback

3. **Add query expansion**:
   ```python
   # "python" → ["python", "programming", "coding"]
   expanded_query = expand_synonyms(query)
   ```

4. **Cache popular queries**:
   ```python
   cache_key = f"search:{mode}:{query}:{page}"
   if cached := await redis.get(cache_key):
       return cached
   ```

5. **Log zero-result queries**: Identify gaps in content

### Testing Tips

```python
# Test semantic search
async def test_semantic_search():
    response = await client.get(
        "/api/v1/search/videos",
        params={"query": "learn programming", "mode": "semantic"}
    )

    assert response.status_code == 200
    data = response.json()

    # Check pagination structure
    assert "data" in data
    assert "pagination" in data

    # Check similarity scores
    for video in data["data"]:
        assert "$similarity" in video
        assert 0 <= video["$similarity"] <= 1

# Test keyword search
async def test_keyword_search():
    response = await client.get(
        "/api/v1/search/videos",
        params={"query": "python", "mode": "keyword"}
    )

    assert response.status_code == 200
    data = response.json()

    # Results should contain "python" in name
    for video in data["data"]:
        assert "python" in video["name"].lower()

# Test empty results
async def test_no_results():
    response = await client.get(
        "/api/v1/search/videos",
        params={"query": "xyzabc123notfound"}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 0
    assert data["pagination"]["totalItems"] == 0

# Test pagination
async def test_search_pagination():
    response = await client.get(
        "/api/v1/search/videos",
        params={"query": "tutorial", "page": 2, "pageSize": 5}
    )

    data = response.json()
    assert data["pagination"]["currentPage"] == 2
    assert data["pagination"]["pageSize"] == 5
    assert len(data["data"]) <= 5
```

## Related Endpoints

- [GET /api/v1/search/videos](/services/search/get-search-videos/) - This endpoint
- [BM25 Search Roadmap](/advanced/bm25-roadmap/) - Future full-text search improvements

## Further Learning

- [Vector Search in Cassandra](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html)
- [NVIDIA NV-Embed-QA Model](https://huggingface.co/nvidia/NV-Embed-v2)
- [Cosine Similarity Explained](https://en.wikipedia.org/wiki/Cosine_similarity)
- [Approximate Nearest Neighbor (ANN) Algorithms](https://www.datastax.com/blog/vector-search-using-astra-db)
- [Vector Database Use Cases](https://www.pinecone.io/learn/vector-database/)
