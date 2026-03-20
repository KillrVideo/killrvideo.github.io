---
title: Recommendations
order: 1
description: Personalized video recommendations powered by vector similarity
---

# Recommendations

The Recommendations service delivers personalized video recommendations using vector similarity search. It ingests viewing signals and uses NVIDIA embeddings stored in Astra DB to find semantically related content.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/{user_id}/recommendations` | Get personalized recommendations for a user |
| POST | `/api/v1/recommendations/ingest` | Ingest viewing signal for recommendation model |
| GET | `/api/v1/videos/{video_id}/related` | Get videos related to a given video |
