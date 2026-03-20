---
title: "BM25 Full-Text Search Roadmap"
description: "How to add BM25 full-text search to Astra DB"
order: 2
---

# BM25 Full-Text Search Roadmap for Astra DB

## Overview

This document outlines how to add **BM25 (Best Match 25)** full-text search to the KillrVideo application using Astra DB and Cassandra's Storage-Attached Indexes (SAI).

**What is BM25?** A ranking algorithm for full-text search that scores documents based on term frequency, document length, and corpus statistics. It's the algorithm behind most modern search engines (Elasticsearch, Solr, etc.).

**Current State**: KillrVideo uses:
- **Vector search** (semantic): For meaning-based queries
- **Keyword search** (regex): For simple text matching

**Goal**: Add BM25 for production-quality full-text search with ranking.

## Why BM25?

### Comparison of Search Methods

| Feature | Keyword (Regex) | Vector (Semantic) | BM25 (Full-Text) |
|---------|-----------------|-------------------|------------------|
| **Exact matches** | Excellent | Poor | Excellent |
| **Fuzzy matches** | None | Excellent | Limited |
| **Phrase search** | Basic | None | Excellent |
| **Ranking quality** | None | Excellent | Excellent |
| **Query speed** | 10-50ms | 50-200ms | 5-30ms |
| **Storage overhead** | Minimal | 16KB/doc | Moderate |
| **Setup complexity** | Easy | Complex | Moderate |

**When to use BM25**:
- Product catalogs (e-commerce)
- Document search (knowledge bases)
- Multi-field queries ("search title AND description")
- Precise ranking based on term importance

**When to use Vector**:
- Natural language queries ("videos about...")
- Conceptual similarity
- Cross-language search
- Recommendation systems

**Best practice**: Use **both** together!

## Implementation Roadmap

### Phase 1: Enable SAI Text Indexes (Basic)

**Timeline**: 1-2 weeks

**Goal**: Replace regex search with SAI text indexes

#### Step 1.1: Create SAI Indexes

```cql
-- Index video names for text search
CREATE CUSTOM INDEX IF NOT EXISTS videos_name_text_idx
ON killrvideo.videos(name)
USING 'StorageAttachedIndex';

-- Index descriptions
CREATE CUSTOM INDEX IF NOT EXISTS videos_description_text_idx
ON killrvideo.videos(description)
USING 'StorageAttachedIndex';

-- Index tags (already exists for filtering, reuse for text)
CREATE CUSTOM INDEX IF NOT EXISTS videos_tags_idx
ON killrvideo.videos(tags)
USING 'StorageAttachedIndex';
```

#### Step 1.2: Update Search Service

```python
async def search_videos_by_text(
    query: str,
    page: int,
    page_size: int
) -> Tuple[List[VideoSummary], int]:
    """Full-text search across name, description, tags using SAI."""

    videos_table = await get_table("videos")

    # Multi-field search using $or
    cursor = videos_table.find(
        filter={
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
                {"tags": query}  # Exact tag match
            ]
        },
        limit=page_size,
        skip=(page - 1) * page_size
    )

    docs = await cursor.to_list()
    summaries = [VideoSummary.model_validate(d) for d in docs]

    return summaries, len(docs)
```

**Limitations**:
- No relevance scoring (results not ranked)
- Case-insensitive regex (not true full-text)
- No stemming ("running" won't match "run")

### Phase 2: Add Relevance Scoring (Intermediate)

**Timeline**: 2-4 weeks

**Goal**: Rank results by relevance using client-side scoring

#### Step 2.1: Implement TF-IDF Scoring

**TF-IDF** (Term Frequency-Inverse Document Frequency) is a simplified version of BM25.

```python
import math
from collections import Counter
from typing import List, Dict

def compute_tfidf_score(
    query: str,
    document: str,
    corpus_size: int,
    term_doc_counts: Dict[str, int]
) -> float:
    """Compute TF-IDF score for a document given a query."""

    query_terms = query.lower().split()
    doc_terms = document.lower().split()
    doc_term_counts = Counter(doc_terms)

    score = 0.0

    for term in query_terms:
        # Term Frequency (TF)
        tf = doc_term_counts.get(term, 0) / max(len(doc_terms), 1)

        # Inverse Document Frequency (IDF)
        doc_count = term_doc_counts.get(term, 1)
        idf = math.log(corpus_size / doc_count)

        score += tf * idf

    return score
```

**Limitations**:
- Client-side scoring (slow for large result sets)
- Multiple queries needed (corpus stats)
- Not true BM25 (missing saturation, length normalization)

### Phase 3: True BM25 with Cassandra 5.x (Advanced)

**Timeline**: 4-8 weeks (requires Cassandra upgrade)

**Goal**: Server-side BM25 scoring using Cassandra 5.x SAI improvements

**Note**: This requires Cassandra 5.x features that may not be fully available in current Astra DB.

#### Step 3.1: Create BM25-Enabled Indexes

**Hypothetical future CQL** (syntax may vary):

```cql
CREATE CUSTOM INDEX videos_fulltext_bm25_idx
ON killrvideo.videos(name, description)
USING 'StorageAttachedIndex'
WITH OPTIONS = {
    'analyzer': 'standard',           -- Tokenization + stemming
    'scoring': 'bm25',                -- Ranking algorithm
    'k1': 1.2,                        -- BM25 parameter (term saturation)
    'b': 0.75                         -- BM25 parameter (length normalization)
};
```

**Parameters**:
- **k1** (1.0-2.0): Controls term frequency saturation (default 1.2)
- **b** (0.0-1.0): Controls document length normalization (default 0.75)

#### Step 3.2: Query with BM25 Scoring

**Hypothetical future Data API syntax**:

```python
cursor = videos_table.find(
    filter={
        "$text": {
            "query": "python tutorial beginners",
            "fields": ["name", "description"],
            "analyzer": "standard"
        }
    },
    sort={"$score": -1},  # Sort by relevance score
    limit=page_size,
    include_score=True     # Return BM25 score
)
```

**Benefits**:
- Server-side scoring (fast)
- True BM25 algorithm
- Phrase queries, stemming, stopwords
- Multi-field boosting (name > description)

## Hybrid Search Architecture (Recommended)

The best approach combines **all three** search methods:

```python
async def search_videos_hybrid(
    query: str,
    page: int,
    page_size: int,
    weights: Dict[str, float] = None
) -> Tuple[List[VideoSummary], int]:
    """Hybrid search combining BM25, vector, and keyword."""

    if weights is None:
        weights = {"bm25": 0.5, "vector": 0.3, "keyword": 0.2}

    # Execute all three searches in parallel
    bm25_results, vector_results, keyword_results = await asyncio.gather(
        search_with_bm25(query, page, page_size * 2),
        search_with_vector(query, page, page_size * 2),
        search_with_keyword(query, page, page_size * 2)
    )

    # Normalize scores to 0-1 range
    normalized = {
        "bm25": _normalize_scores(bm25_results),
        "vector": _normalize_scores(vector_results),
        "keyword": _normalize_scores(keyword_results)
    }

    # Combine scores with weights
    combined_scores = {}

    for method, results in normalized.items():
        for video_id, score in results.items():
            if video_id not in combined_scores:
                combined_scores[video_id] = 0.0
            combined_scores[video_id] += score * weights[method]

    # Sort by combined score
    ranked_videos = sorted(
        combined_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    return videos, len(ranked_videos)
```

**Benefits**:
- **BM25**: Handles exact term matches, phrases
- **Vector**: Handles semantic queries, synonyms
- **Keyword**: Fallback for simple queries

**Tunable weights**: Adjust based on user feedback and A/B testing.

## Implementation Checklist

### Phase 1: SAI Text Indexes
- [ ] Create SAI indexes on `name`, `description`, `tags`
- [ ] Update `search_videos_by_keyword()` to use multi-field $or query
- [ ] Add search mode parameter: `?mode=text`
- [ ] Test case-insensitive search
- [ ] Deploy and monitor performance

### Phase 2: Client-Side Ranking
- [ ] Implement TF-IDF scoring function
- [ ] Build term document count index
- [ ] Add scoring to search results
- [ ] Benchmark performance (should be < 100ms for 1000 docs)
- [ ] Compare ranking quality vs keyword search
- [ ] Add caching for corpus statistics

### Phase 3: Server-Side BM25 (Future)
- [ ] Monitor Cassandra 5.x BM25 feature availability in Astra
- [ ] Test BM25 index creation in staging
- [ ] Migrate from client-side to server-side scoring
- [ ] Tune BM25 parameters (k1, b)
- [ ] A/B test BM25 vs TF-IDF
- [ ] Document new query syntax

### Phase 4: Hybrid Search
- [ ] Implement hybrid search combining BM25 + vector + keyword
- [ ] Add weight tuning interface
- [ ] A/B test hybrid vs individual methods
- [ ] Optimize for latency (parallel queries)
- [ ] Add result diversity logic
- [ ] Monitor search quality metrics (click-through rate, etc.)

## Performance Considerations

### Storage

| Method | Storage per 1M Videos |
|--------|-----------------------|
| Keyword (regex) | ~100 MB (index overhead) |
| TF-IDF (client-side) | ~500 MB (term statistics) |
| BM25 (server-side) | ~500 MB (inverted index) |
| Vector | ~16 GB (embeddings) |

### Query Latency

| Method | Expected Latency | Scalability |
|--------|------------------|-------------|
| Keyword (SAI) | 10-50ms | Linear with corpus |
| TF-IDF (client) | 50-200ms | Slow for large corpus |
| BM25 (server) | 10-40ms | Sub-linear with index |
| Vector | 50-200ms | Depends on ANN algorithm |
| Hybrid | 60-250ms | Parallel execution helps |

### Cost

| Method | Cost Factor |
|--------|-------------|
| Keyword | Low (index storage) |
| TF-IDF | Medium (compute for scoring) |
| BM25 | Medium (index storage + compute) |
| Vector | High (embeddings + compute) |

## Testing Strategy

### Unit Tests

```python
# Test BM25 scoring
def test_bm25_score():
    doc = "python tutorial for beginners"
    query = "python tutorial"

    score = compute_bm25_score(query, doc, corpus_size=1000, ...)

    assert score > 0
    assert score > compute_bm25_score("java tutorial", doc, ...)

# Test ranking
async def test_search_ranking():
    results = await search_with_bm25("python tutorial", page=1, page_size=10)

    # First result should be most relevant
    assert "python" in results[0].name.lower()

    # Scores should be descending
    for i in range(len(results) - 1):
        assert results[i].score >= results[i+1].score
```

## Migration Path

### For Existing Applications

1. **Add BM25 alongside existing search** (don't replace immediately)
   ```python
   # Support both modes
   if mode == "bm25":
       results = search_with_bm25(query)
   else:
       results = search_with_keyword(query)  # Keep old behavior
   ```

2. **A/B test with real users** (50/50 traffic split)

3. **Monitor metrics**:
   - Search latency (p50, p95, p99)
   - Result click-through rate
   - Zero-result queries
   - User satisfaction scores

4. **Gradually increase BM25 traffic** (0% → 10% → 50% → 100%)

5. **Make BM25 the default** after validation

### Backward Compatibility

```python
# Support old API
@router.get("/search/videos")
async def search_videos(
    query: str,
    mode: Literal["keyword", "semantic", "bm25"] = "bm25",  # BM25 default
    legacy: bool = False  # Force old keyword search
):
    if legacy:
        return await search_videos_by_keyword(query)

    # New unified search
    return await search_videos_unified(query, mode)
```

## Resources

### Cassandra Documentation
- [SAI Overview](https://docs.datastax.com/en/storage-attached-index/latest/)
- [Cassandra 5.0 Features](https://cassandra.apache.org/doc/5.0/)
- [Text Search with SAI](https://docs.datastax.com/en/astra-db-serverless/databases/cql/sai.html)

### BM25 Algorithm
- [BM25 Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Understanding BM25](https://www.elastic.co/blog/practical-bm25-part-1-how-shards-affect-relevance-scoring-in-elasticsearch)
- [BM25 vs TF-IDF](https://kmwllc.com/index.php/2020/03/20/understanding-tf-idf-and-bm-25/)

## Next Steps

1. **Evaluate current needs**: Is keyword search sufficient, or do you need ranking?

2. **Check Astra roadmap**: When will BM25 features be available?

3. **Start with Phase 1**: SAI text indexes are available now

4. **Plan for Phase 2**: Client-side TF-IDF for interim solution

5. **Future-proof for Phase 3**: Design APIs to support server-side BM25 later

6. **Consider hybrid**: Most production systems use multiple search methods

---

**Status**: Roadmap (BM25 server-side features pending in Astra DB)
