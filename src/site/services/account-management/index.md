---
title: Account Management
order: 1
description: User registration, authentication, and profile management
---

# Account Management

The Account Management service handles user registration, authentication via JWT, and profile management. It demonstrates partition key design, SAI indexes, and dual-table write patterns.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users/register` | Create a new user account |
| POST | `/api/v1/users/login` | Authenticate and receive JWT |
| GET | `/api/v1/users/me` | Get current user profile |
| PUT | `/api/v1/users/me` | Update current user profile |
| GET | `/api/v1/users/{user_id}` | Get public user profile |
