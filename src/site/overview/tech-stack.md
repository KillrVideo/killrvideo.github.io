---
title: Technology Stack
order: 2
description: Technologies used in KillrVideo 2025
---

# Technology Stack

KillrVideo 2025 uses a focused set of technologies. Each was chosen either because it is the recommended way to build on Astra DB or because it demonstrates a pattern that developers building real applications will encounter.

## DataStax Astra DB

[Astra DB](https://astra.datastax.com) is a cloud-native, serverless Cassandra database. It is managed — no cluster to provision, no hardware to configure. It scales automatically and offers a free tier sufficient to run KillrVideo and experiment with all its features.

Astra DB is Apache Cassandra under the hood. The data model, partition key semantics, clustering columns, and consistency model are all standard Cassandra. What Astra adds is the operational layer: automatic backups, multi-region replication, and the Data API.

## Astra Data API

The Data API is an HTTP/JSON interface to Astra DB. Instead of connecting with a Cassandra driver, you send HTTP requests with JSON bodies. The API supports two modes:

- **Tables** — structured schema with explicit column types, close to how you would use a CQL driver.
- **Collections** — schemaless JSON documents with automatic ID generation.

KillrVideo uses Tables throughout. The Data API supports MongoDB-like operators for filtering and mutation:

- `$set` — partial document update
- `$inc` — atomic increment (used for counters)
- `$in` — match against a list of values
- `$regex` — text pattern matching
- `$vectorize` — automatic embedding generation on insert

The API also supports vector similarity search with an `sort` clause using a query vector, and returns a `$similarity` score alongside results.

## FastAPI

[FastAPI](https://fastapi.tiangolo.com/) is the Python web framework for the KillrVideo backend. It was chosen for several reasons:

- **Async-first**: FastAPI is built on Starlette and supports `async/await` throughout, which pairs well with AstraPy's async Data API client.
- **Pydantic validation**: Request and response bodies are defined as Pydantic models. FastAPI validates inputs automatically and returns structured 422 errors for invalid payloads.
- **OpenAPI generation**: FastAPI generates a Swagger UI at `/docs` automatically from your route definitions and Pydantic models. KillrVideo's full API is explorable there without any additional tooling.
- **Dependency injection**: FastAPI's `Depends()` system is used for authentication checks throughout. Each protected route declares which role it requires, and the dependency resolves (or rejects) the request before the handler runs.

## JWT Authentication and RBAC

KillrVideo implements stateless authentication with JSON Web Tokens (JWTs), signed with HMAC-SHA256. Tokens are issued at login and carry the user's ID and role assignments.

Three roles are supported:

- **viewer** — the default role assigned to new accounts. Can browse videos, read comments, and use search.
- **creator** — can submit and manage videos. Assigned explicitly after registration.
- **moderator** — can review flagged content and take moderation actions. Restricted to moderator accounts.

Role enforcement happens through FastAPI dependencies (`get_current_viewer`, `get_current_creator`, `get_current_moderator`). The dependency decodes the token, validates the signature and expiry, and checks the required role.

## Python and Poetry

Python 3.11 or later is required. Dependencies are managed with [Poetry](https://python-poetry.org/), which handles virtual environment creation, dependency locking, and script execution. The key runtime dependencies are:

- `fastapi` and `uvicorn` — web framework and ASGI server
- `astrapy` — DataStax's Python SDK for the Data API
- `pydantic` — data validation and settings management
- `python-jose` — JWT encoding and decoding
- `passlib[bcrypt]` — password hashing

## NVIDIA NV-Embed-QA

Vector embeddings for the Search and Recommendations domains are generated using NVIDIA's NV-Embed-QA model. This model produces 4096-dimensional embeddings optimized for retrieval tasks — finding semantically similar text rather than exact keyword matches.

When a video is submitted, its title and description are passed to the embedding model. The resulting vector is stored in Astra DB alongside the video metadata. At search time, the query string is embedded with the same model and the vector index returns the nearest neighbors — videos that are semantically related to what the user asked for, even if they share no exact keywords.

Astra DB handles the vector index natively. No separate vector database or additional infrastructure is required.
