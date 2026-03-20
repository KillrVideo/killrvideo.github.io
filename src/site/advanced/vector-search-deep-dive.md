---
title: "Vector Search Deep Dive"
description: "How KillrVideo uses Astra DB vector search for semantic video recommendations — covering embeddings, NVIDIA NV-Embed-QA, cosine similarity, ANN search, and SAI vector indexes"
order: 1
draft: true
---

# Vector Search Deep Dive

## Overview

KillrVideo uses vector search to power semantic video recommendations. Instead of matching keywords, vector search understands the *meaning* of text — so a search for "action movies with car chases" can return videos about racing, heist films, and spy thrillers even if those exact words never appear in the video metadata.

This page explains how vector search works from first principles, how Astra DB implements it, and how KillrVideo uses it in the recommendations service.

---

## What Are Vectors?

A **vector** is an ordered list of numbers. In the context of machine learning, vectors represent the "meaning" of text, images, or other data as a point in high-dimensional space.

Consider a simple example with 3 dimensions:
```
"action movie"   → [0.8, 0.1, 0.3]
"thriller film"  → [0.7, 0.2, 0.4]
"cooking video"  → [0.1, 0.9, 0.1]
```

In this (simplified) space:
- "action movie" and "thriller film" are close together (similar meaning)
- "cooking video" is far away (different meaning)

Real-world embeddings use hundreds or thousands of dimensions to capture much more nuanced semantic relationships.

---

## How Embeddings Work

An **embedding model** is a neural network trained to convert text (or other data) into vectors such that semantically similar content ends up geometrically close in the vector space.

The process:

```
Text Input                    Embedding Model              Vector Output
─────────────────            ─────────────────           ──────────────────────────
"Learn to cook pasta"   →    NVIDIA NV-Embed-QA    →    [0.021, -0.043, 0.187, ...]
                                                         (4096 dimensions)
```

**Training**: The model learns from massive amounts of text, adjusting its internal weights so that sentences with similar meanings produce similar vectors. After training, the model is frozen and used purely for inference.

**Why high dimensions matter**: Each dimension captures a different "aspect" of meaning. With 4096 dimensions, the model can represent subtle distinctions — the difference between "how to cook pasta" (instructional) and "pasta restaurants in Rome" (informational) is encoded in specific dimensions.

---

## The NVIDIA NV-Embed-QA Model

KillrVideo uses the **NVIDIA NV-Embed-QA** model for generating embeddings. Key characteristics:

| Property | Value |
|----------|-------|
| Model name | `NV-Embed-QA` |
| Embedding dimensions | **4096** |
| Input type | Text (up to ~512 tokens) |
| Optimized for | Question-answer retrieval tasks |
| Provider | NVIDIA API / Astra `vectorize` integration |

**Why NV-Embed-QA**:
- Optimized for asymmetric retrieval (short queries matching longer documents)
- High dimensional output (4096) captures fine-grained semantic distinctions
- Available directly through Astra DB's `vectorize` feature — no separate embedding service needed

**Asymmetric retrieval** means the query and the document don't need to be the same length or format:
- Query: `"funny cat videos"` (short, natural language)
- Document: `"A compilation of hilarious moments featuring cats knocking things off tables, hiding in boxes, and reacting to cucumbers."` (long, descriptive)

The model generates vectors for both, and they end up close in the vector space even though they look very different as text.

---

## Cosine Similarity

Once you have vectors, you need a way to measure how similar two vectors are. **Cosine similarity** is the standard metric for text embeddings.

Cosine similarity measures the angle between two vectors:
- **1.0** = identical direction (same meaning)
- **0.0** = perpendicular (unrelated meaning)
- **-1.0** = opposite direction (opposite meaning)

The formula:
```
similarity(A, B) = (A · B) / (|A| × |B|)
```

Where `·` is the dot product and `|·|` is the vector magnitude.

**Why cosine over Euclidean distance**:
- Cosine similarity normalizes for vector length, so short and long documents aren't penalized just for being different lengths
- Text embeddings tend to cluster on a hypersphere, making cosine a natural fit
- Well-supported in Astra DB and most vector databases

**Similarity thresholds in practice**:

| Similarity | Interpretation |
|------------|----------------|
| > 0.90 | Near-identical content |
| 0.75 – 0.90 | Strongly related topics |
| 0.60 – 0.75 | Related, same general domain |
| 0.40 – 0.60 | Loosely related |
| < 0.40 | Likely unrelated |

KillrVideo typically uses a threshold around **0.70** for recommendations — high enough to be relevant, low enough to surface useful variety.

---

## Approximate Nearest Neighbor (ANN) Search

Finding the most similar vectors is conceptually a nearest-neighbor search: given a query vector, find the K vectors in the database closest to it.

**Exact nearest neighbor** is prohibitively slow at scale:
- Compare query vector against all N stored vectors
- O(N × D) time, where D = dimensions
- For 1 million videos × 4096 dimensions = 4 billion operations per query

**Approximate Nearest Neighbor (ANN)** trades a small amount of accuracy for massive speed gains using index structures (like HNSW — Hierarchical Navigable Small World graphs) that allow fast approximate search:
- Build an index structure at write time (slower writes, but done once)
- At query time, traverse the graph to find approximate nearest neighbors
- Typical result: 95–99% accuracy at 10–100x faster query speed

Astra DB uses HNSW under the hood for its SAI vector indexes.

---

## Astra DB Vectorize Feature

The **vectorize** feature in Astra DB allows you to define an embedding model at the table level. When you insert text, Astra DB automatically generates the embedding vector. You don't call an embedding API separately.

### Table Definition with Vectorize

```cql
CREATE TABLE killrvideo.video_vectors (
    videoid     uuid PRIMARY KEY,
    title       text,
    description text,
    tags        set<text>,
    embedding   vector<float, 4096>
) WITH vectorize = {
    'provider': 'nvidia',
    'model':    'NV-Embed-QA'
};
```

The `embedding` column is of type `vector<float, 4096>` — a list of 4096 floating-point numbers.

### Automatic Embedding on Insert

With vectorize configured, inserting a video automatically generates its embedding:

```python
# No need to call NVIDIA API separately — Astra handles it
await video_vectors_table.insert_one({
    "videoid": str(video_id),
    "title": "Learning Python for Beginners",
    "description": "A comprehensive introduction to Python programming...",
    "tags": ["python", "programming", "tutorial"],
    "$vectorize": "Learning Python for Beginners. A comprehensive intro to Python..."
})
```

The `$vectorize` field tells Astra which text to embed. The `embedding` column is populated automatically by calling the NVIDIA NV-Embed-QA model.

### Manual Embedding (Without Vectorize)

If you generate embeddings yourself (e.g., using the NVIDIA API directly), you insert the vector explicitly:

```python
import httpx

async def get_embedding(text: str) -> list[float]:
    response = await httpx.post(
        "https://integrate.api.nvidia.com/v1/embeddings",
        json={
            "input": text,
            "model": "nvidia/nv-embed-qa-e5-v5",
            "input_type": "passage",
            "encoding_format": "float"
        },
        headers={"Authorization": f"Bearer {nvidia_api_key}"}
    )
    return response.json()["data"][0]["embedding"]

# Insert with explicit vector
embedding = await get_embedding("Learning Python for Beginners...")
await video_vectors_table.insert_one({
    "videoid": str(video_id),
    "embedding": embedding  # 4096-element list
})
```

---

## SAI Vector Indexes

Astra DB uses **Storage-Attached Index (SAI)** extended with vector capabilities to power ANN search.

### Creating a Vector Index

```cql
CREATE CUSTOM INDEX video_vectors_embedding_idx
ON killrvideo.video_vectors(embedding)
USING 'StorageAttachedIndex'
WITH OPTIONS = {
    'similarity_function': 'cosine'
};
```

Key options:
- `similarity_function`: `cosine` (recommended for text), `dot_product`, or `euclidean`
- The index builds the HNSW graph structure automatically

### ANN Search Query

```cql
-- Find 10 videos most similar to a query vector
SELECT videoid, title, similarity_cosine(embedding, [0.021, -0.043, ...]) AS score
FROM killrvideo.video_vectors
ORDER BY embedding ANN OF [0.021, -0.043, ...]
LIMIT 10;
```

The `ANN OF` clause triggers the vector index. Cassandra traverses the HNSW graph to find approximate nearest neighbors without scanning every row.

### Using the Data API

Through the Astra Data API (which KillrVideo uses), vector search looks like:

```python
async def find_similar_videos(query_vector: list[float], limit: int = 10):
    video_vectors_table = await get_table("video_vectors")

    results = await video_vectors_table.find(
        filter={},
        sort={"$vector": query_vector},
        limit=limit,
        projection={"videoid": True, "title": True, "$similarity": True}
    )
    return list(results)
```

The `sort={"$vector": query_vector}` tells the Data API to perform ANN search. The `$similarity` projection includes the cosine similarity score in the results.

### Using Vectorize for Query Embedding

With vectorize, you can search using raw text instead of a pre-computed vector:

```python
async def find_similar_videos_by_text(query_text: str, limit: int = 10):
    video_vectors_table = await get_table("video_vectors")

    results = await video_vectors_table.find(
        filter={},
        sort={"$vectorize": query_text},  # Astra generates embedding automatically
        limit=limit,
        projection={"videoid": True, "title": True, "$similarity": True}
    )
    return list(results)
```

Astra DB calls the NVIDIA NV-Embed-QA model on `query_text`, then performs ANN search with the resulting vector. All in one API call.

---

## Similarity Thresholds

Not all ANN results are equally relevant. Filtering by similarity score ensures only meaningful results are returned:

```python
MIN_SIMILARITY_THRESHOLD = 0.70

async def get_recommendations(video_id: str, limit: int = 10):
    # Get the video's embedding
    source_video = await video_vectors_table.find_one(
        filter={"videoid": video_id},
        projection={"embedding": True}
    )

    if not source_video or not source_video.get("embedding"):
        return []

    # Find similar videos
    results = await video_vectors_table.find(
        filter={"videoid": {"$ne": video_id}},  # Exclude self
        sort={"$vector": source_video["embedding"]},
        limit=limit * 2,  # Over-fetch to account for threshold filtering
        projection={"videoid": True, "title": True, "$similarity": True}
    )

    # Filter by minimum similarity
    recommendations = [
        r for r in results
        if r.get("$similarity", 0) >= MIN_SIMILARITY_THRESHOLD
    ]

    return recommendations[:limit]
```

**Why over-fetch**: ANN search returns the top-K results by similarity. If you apply a threshold filter after the fact, you might get fewer than K results. Over-fetching (e.g., 20 when you want 10) and then filtering gives you more buffer.

**Choosing a threshold**: Start at 0.70 and adjust based on result quality. Too high (0.90+) returns few results; too low (0.40) returns irrelevant content.

---

## How KillrVideo Uses Vector Search

The [Recommendations service](/services/recommendations/) uses vector search in two scenarios:

### 1. "More Like This" — Similar Videos

When viewing a video, the system finds semantically similar videos:

```
Video being watched:
"Introduction to Docker Containers"
(embedding: [0.18, 0.31, ...])
         │
         ▼ ANN search

Similar videos returned:
- "Docker for Beginners" (similarity: 0.91)
- "Kubernetes Fundamentals" (similarity: 0.83)
- "Container Orchestration Guide" (similarity: 0.78)
- "DevOps Workflow Tutorial" (similarity: 0.71)
```

### 2. Semantic Search

When a user searches the catalog, their query is embedded and compared against video embeddings:

```
Search query: "how to make sourdough bread"
(embedded by NV-Embed-QA → 4096-dim vector)
         │
         ▼ ANN search against video catalog

Results:
- "Sourdough Starter Guide" (similarity: 0.89)
- "Artisan Bread Baking" (similarity: 0.81)
- "Fermentation Basics" (similarity: 0.74)
```

The search returns relevant videos even if the video titles don't contain the exact search terms.

---

## Performance Characteristics

| Operation | Typical Latency | Notes |
|-----------|-----------------|-------|
| Generate embedding (NVIDIA API) | 50–200ms | Network call to NVIDIA |
| Generate embedding (via vectorize) | 50–200ms | Handled by Astra internally |
| ANN search (vector index, 1M rows) | 10–50ms | HNSW graph traversal |
| ANN search without index | 1,000–10,000ms | Full table scan — avoid |
| Insert with vectorize | 100–300ms | Includes embedding generation |

**Key takeaway**: The embedding generation step dominates latency. Once vectors are stored, search is fast even at scale.

---

## Data Modeling Considerations

### Storing Embeddings Alongside Metadata

One approach: add the `embedding` column to the primary `videos` table.
```cql
ALTER TABLE killrvideo.videos
ADD embedding vector<float, 4096>;
```

**Trade-off**: Embedding columns are large (4096 floats × 4 bytes = ~16KB per row). For tables with many rows, this increases storage and scan costs.

### Dedicated Vector Table

Another approach (used by KillrVideo): a separate `video_vectors` table with only the embedding and essential metadata.

```cql
CREATE TABLE killrvideo.video_vectors (
    videoid   uuid PRIMARY KEY,
    embedding vector<float, 4096>,
    -- Minimal metadata for result assembly
    title     text,
    added_date timestamp
);
```

**Benefits**:
- Primary `videos` table rows stay small
- Vector index is built on a smaller, focused table
- Vector-specific operations don't compete with general video queries

### Keeping Embeddings Fresh

When a video's description or tags change, its embedding should be regenerated:

```python
async def update_video_embedding(video_id: str, new_description: str):
    # Regenerate embedding for updated content
    new_embedding = await get_embedding(new_description)

    await video_vectors_table.update_one(
        filter={"videoid": video_id},
        update={"$set": {"embedding": new_embedding}}
    )
```

Stale embeddings cause recommendation drift — the system thinks a video is about one topic when it's been updated to cover another.

---

## Further Learning

- [Astra DB Vector Search Documentation](https://docs.datastax.com/en/astra-db-serverless/api-reference/overview.html)
- [NVIDIA NV-Embed-QA Model](https://build.nvidia.com/nvidia/nv-embedqa-e5-v5)
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320) — the graph structure underlying ANN search
- [Astra Vectorize Feature](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html)
- [Cosine Similarity Explained](https://www.datastax.com/guides/what-is-cosine-similarity)
