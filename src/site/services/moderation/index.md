---
title: Moderation
order: 1
description: Content flagging, moderation queues, and moderator management
---

# Moderation

The Moderation service handles content flagging, moderation workflows, and moderator role management. It demonstrates role-based access control patterns and audit log design with Astra DB.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/flags` | Flag a video or comment for review |
| GET | `/api/v1/flags` | Get the moderation queue |
| POST | `/api/v1/flags/{flag_id}/action` | Take action on a flagged item |
| GET | `/api/v1/flags/{flag_id}` | Get details for a specific flag |
| GET | `/api/v1/moderation/users` | List users with moderation history |
| POST | `/api/v1/moderation/assign` | Assign moderator role to a user |
| POST | `/api/v1/moderation/revoke` | Revoke moderator role from a user |
| POST | `/api/v1/moderation/restore/video` | Restore a previously removed video |
| POST | `/api/v1/moderation/restore/comment` | Restore a previously removed comment |
