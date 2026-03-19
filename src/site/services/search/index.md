---
title: Search
order: 1
description: Full-text and vector search over the video catalog
---

# Search

The Search service provides full-text and vector-based semantic search over the video catalog. It leverages Astra DB's SAI indexes and vector search capabilities with NVIDIA embeddings.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/search/videos?query={q}` | Search videos by keyword or semantic query |
| GET | `/api/v1/search/tags/suggest?prefix={p}` | Get tag suggestions by prefix |
