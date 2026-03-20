---
title: Comments & Ratings
order: 1
description: User comments and star ratings on videos
---

# Comments & Ratings

The Comments & Ratings service handles user comments on videos and star rating submissions. It demonstrates counter columns, time-ordered queries, and aggregation patterns in Astra DB.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/videos/{video_id}/comments` | Post a comment on a video |
| GET | `/api/v1/videos/{video_id}/comments` | Get comments for a video |
| GET | `/api/v1/users/{user_id}/comments` | Get comments by a user |
| POST | `/api/v1/videos/{video_id}/ratings` | Submit a star rating |
| GET | `/api/v1/videos/{video_id}/ratings` | Get ratings summary for a video |
