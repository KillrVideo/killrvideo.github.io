---
title: Video Catalog
order: 1
description: Video storage, retrieval, and metadata management
---

# Video Catalog

The Video Catalog service manages video submissions, metadata, ratings, and view tracking. It demonstrates time-series data patterns, secondary indexes, and materialized views with Astra DB.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/videos/latest` | Get latest videos |
| POST | `/api/v1/videos` | Submit a new video |
| GET | `/api/v1/videos?tag={tag}` | Get videos by tag |
| POST | `/api/v1/videos/{video_id}/views` | Record a video view |
| GET | `/api/v1/videos/{video_id}` | Get video by ID |
| PUT | `/api/v1/videos/{video_id}` | Update video metadata |
| GET | `/api/v1/videos/{video_id}/status` | Get video processing status |
| GET | `/api/v1/users/{user_id}/videos` | Get videos by uploader |
| GET | `/api/v1/videos/trending` | Get trending videos |
| POST | `/api/v1/videos/{video_id}/ratings` | Rate a video |
| GET | `/api/v1/videos/{video_id}/ratings` | Get video ratings |
| GET | `/api/v1/videos/{video_id}/related` | Get related videos |
| POST | `/api/v1/videos/{video_id}/preview` | Submit video preview |
