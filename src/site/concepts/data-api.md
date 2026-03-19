---
title: Astra Data API
order: 4
description: Working with the Astra DB Data API
---

# Astra Data API

The Astra Data API is an HTTP/JSON interface to Astra DB. Instead of connecting to Cassandra with a driver, you send HTTP requests with JSON bodies. KillrVideo uses the Data API exclusively — there is no CQL driver dependency anywhere in the codebase.

## Why Use the Data API

**No driver installation or version management.** Traditional Cassandra applications require a language-specific driver (Java driver, Python driver, etc.) that must be kept in sync with the Cassandra version. The Data API is just HTTP — any language that can make HTTP requests can use it.

**Consistent interface across languages.** The same JSON operations work from Python, JavaScript, Java, or curl. This is why KillrVideo's API contract translates cleanly to other implementation languages.

**Built-in vector support.** The Data API natively supports vector storage and similarity search, including automatic embedding generation with `$vectorize`. No separate vector database required.

**AstraPy for Python.** The [AstraPy](https://github.com/datastax/astrapy) SDK wraps the Data API with a Python-native async interface. KillrVideo uses AstraPy throughout the backend, but everything AstraPy does is standard HTTP under the hood.

## Tables vs Collections

The Data API supports two storage modes:

- **Collections** — schemaless JSON documents. Flexible structure, automatic `_id` generation, MongoDB-like feel. Good for prototyping.
- **Tables** — structured schema with explicit column types, matching how Cassandra tables work with CQL. Better performance, explicit schema contracts.

KillrVideo uses **Tables** throughout. This is the recommended approach for applications with a known schema, which is true of most production applications.

## Core Operations

All operations are performed on a specific table. The basic CRUD operations:

**Find one document** (equivalent to `SELECT ... WHERE ... LIMIT 1`):

```json
{
  "findOne": {
    "filter": { "user_id": "550e8400-e29b-41d4-a716-446655440000" }
  }
}
```

**Find multiple documents** (with pagination):

```json
{
  "find": {
    "filter": { "video_id": "a8098c1a-f86e-11da-bd1a-00112444be1e" },
    "options": { "limit": 20 }
  }
}
```

**Insert one document**:

```json
{
  "insertOne": {
    "document": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "dev@example.com",
      "first_name": "Dev",
      "created_at": { "$date": 1742400000000 }
    }
  }
}
```

**Update one document** (partial update):

```json
{
  "updateOne": {
    "filter": { "video_id": "a8098c1a-f86e-11da-bd1a-00112444be1e" },
    "update": {
      "$set": { "title": "Updated Title" }
    }
  }
}
```

**Delete one document**:

```json
{
  "deleteOne": {
    "filter": { "video_id": "a8098c1a-f86e-11da-bd1a-00112444be1e" }
  }
}
```

## Operators

The Data API supports MongoDB-style operators for filtering and updates:

| Operator | Use | Example |
|---|---|---|
| `$set` | Partial update (set specific fields) | `{ "$set": { "title": "New Title" } }` |
| `$inc` | Atomic increment | `{ "$inc": { "view_count": 1 } }` |
| `$in` | Match against a list of values | `{ "status": { "$in": ["active", "pending"] } }` |
| `$regex` | Text pattern match | `{ "title": { "$regex": "cassandra" } }` |
| `$gt`, `$lt`, `$gte`, `$lte` | Numeric and date comparisons | `{ "created_at": { "$gt": { "$date": 1742000000000 } } }` |

The `$set` operator is important for Cassandra-style partial updates: instead of reading a document, modifying it, and writing it back, you specify only the fields to change. This is more efficient and avoids race conditions.

## Vector Operations

The Data API's vector support is used for KillrVideo's semantic search and recommendations.

**Store a vector** (generated externally, e.g. by NVIDIA NV-Embed-QA):

```json
{
  "insertOne": {
    "document": {
      "video_id": "...",
      "title": "Introduction to Cassandra",
      "$vector": [0.021, -0.034, 0.156, ...]
    }
  }
}
```

**Automatic vectorization** (let Astra generate the embedding):

```json
{
  "insertOne": {
    "document": {
      "video_id": "...",
      "title": "Introduction to Cassandra",
      "$vectorize": "Introduction to Cassandra data modeling"
    }
  }
}
```

**Vector similarity search**:

```json
{
  "find": {
    "sort": { "$vector": [0.021, -0.034, 0.156, ...] },
    "options": {
      "limit": 10,
      "includeSimilarity": true
    }
  }
}
```

This returns the 10 most similar documents to the query vector, ordered by cosine similarity. The `includeSimilarity` option adds a `$similarity` field (0.0 to 1.0) to each result.

## Using AstraPy

In KillrVideo's Python backend, the Data API is accessed through AstraPy's async client:

```python
from astrapy import AsyncDataAPIClient

client = AsyncDataAPIClient(token=ASTRA_DB_APPLICATION_TOKEN)
db = client.get_async_database(ASTRA_DB_API_ENDPOINT)
videos_table = db.get_table("videos")

# Find a video
video = await videos_table.find_one({"video_id": video_id})

# Insert a video
await videos_table.insert_one({
    "video_id": str(uuid4()),
    "title": "My Video",
    "created_at": datetime.utcnow()
})

# Vector search
results = await videos_table.find(
    {},
    sort={"$vector": query_vector},
    limit=10,
    include_similarity=True
)
```

AstraPy's interface mirrors the Data API JSON operations directly, making it easy to understand what HTTP request each call produces.
