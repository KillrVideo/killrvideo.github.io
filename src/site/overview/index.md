---
title: Architecture & Vision
order: 1
description: KillrVideo 2025 architecture overview
---

# KillrVideo 2025 Architecture

KillrVideo is a reference application built to teach developers how to build real-world applications on [DataStax Astra DB](https://astra.datastax.com). It models a video sharing platform — think a simplified YouTube — and each feature maps to a specific database pattern or API concept you would encounter in production.

## What KillrVideo Is

The goal of KillrVideo is not to ship a production video service. The goal is to show you exactly how to solve specific data problems with Cassandra and Astra DB. Every endpoint in the API was chosen because it demonstrates something meaningful: how to model a time-series feed, how to paginate efficiently, how to use vector embeddings for search, how to handle denormalized writes. You read the code and you learn the pattern.

## How KillrVideo 2025 Differs from the Original

The original KillrVideo (circa 2016-2018) ran on DataStax Enterprise (DSE), used gRPC for inter-service communication, required a local Docker environment with multiple containers, and was split into separate microservices written in multiple languages. It was a good reference for that era but hard to run and hard to learn from.

KillrVideo 2025 takes a different approach:

| Old KillrVideo | KillrVideo 2025 |
|---|---|
| DataStax Enterprise (DSE) | DataStax Astra DB (cloud, free tier) |
| gRPC between services | REST API, standard HTTP/JSON |
| Docker Compose, multiple containers | Single FastAPI backend process |
| CQL driver for database access | Astra Data API (HTTP/JSON) |
| Multiple language implementations | Python (FastAPI) reference implementation |

The new version requires only a free Astra DB account and a Python environment. You can be running the application within minutes.

## The Six Service Domains

KillrVideo organizes its functionality into six domains, each owning a distinct set of tables and endpoints:

- **Account Management** — user registration, login, profile management. Demonstrates UUID-keyed user records, bcrypt password hashing, and JWT issuance.
- **Video Catalog** — video submission, metadata storage, paginated video listings. Demonstrates time-series patterns and efficient range queries.
- **Search** — keyword and semantic search over video titles and descriptions. Demonstrates SAI (Storage-Attached Indexes) and vector similarity search.
- **Comments & Ratings** — per-video comments and star ratings. Demonstrates counter patterns, denormalized writes, and aggregation.
- **Recommendations** — personalized video suggestions using vector embeddings. Demonstrates ANN (approximate nearest neighbor) queries against high-dimensional vectors.
- **Moderation** — content flagging and moderator workflows. Demonstrates RBAC enforcement and queue-style data patterns.

## Backend Architecture

KillrVideo 2025 uses a **monolith backend** — a single FastAPI application that hosts all six service domains under one process. This is intentional. The domain boundaries are maintained in code (separate routers, separate service modules, separate table ownership) but they run together. This makes local development simple: one server, one config file, one process to start.

The application exposes a REST API under `/api/v1`. All payloads are JSON. Authentication uses JWTs passed as Bearer tokens in the Authorization header.

## The Data Layer: Astra DB with the Data API

KillrVideo does not use a Cassandra driver. All database access goes through the **Astra Data API** — an HTTP/JSON interface that sits in front of Astra DB. You make HTTP requests with JSON bodies; the Data API translates them to Cassandra operations.

This approach has practical advantages for a reference application: no driver version management, no connection pooling configuration, and the same interface works from any language that can make HTTP requests. The Python SDK (AstraPy) wraps the Data API with an async client, but the underlying protocol is plain HTTP.

## AI Features

The Search and Recommendations domains use **NVIDIA NV-Embed-QA** to generate 4096-dimensional vector embeddings from video titles and descriptions. When a user submits a video, the backend generates an embedding and stores it alongside the video metadata. Search queries are also embedded, enabling semantic search — finding videos by meaning rather than exact keyword match.

Astra DB stores and indexes these vectors natively. The Data API exposes vector similarity queries using the same JSON interface as ordinary document queries.

## Design Philosophy

Each endpoint in KillrVideo was designed to teach exactly one Cassandra concept. The user registration endpoint teaches primary key design. The video feed endpoint teaches partition-based time ordering. The search endpoint teaches SAI and vector indexes. If you read through all the endpoints, you will have covered the core Cassandra data modeling patterns that matter for application development.
