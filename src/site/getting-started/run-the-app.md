---
title: Run the Application
order: 2
description: Clone, configure, and run KillrVideo locally
---

# Run the Application

This page walks you through cloning the KillrVideo backend, configuring it with your Astra DB credentials, and starting the server.

## Clone the Repository

```bash
git clone https://github.com/KillrVideo/kv-be-python-fastapi-dataapi-table.git
cd kv-be-python-fastapi-dataapi-table
```

## Install Dependencies

Poetry creates a virtual environment and installs all required packages:

```bash
poetry install
```

This may take a minute the first time. All dependencies are pinned in `poetry.lock`, so you get exactly the same versions every time.

## Configure the Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in your Astra DB credentials:

```bash
# Your Astra DB Application Token (starts with AstraCS:)
ASTRA_DB_APPLICATION_TOKEN=AstraCS:your-token-here

# Your Astra DB API Endpoint
ASTRA_DB_API_ENDPOINT=https://your-database-id-region.apps.astra.datastax.com

# The keyspace to use (usually your database name)
ASTRA_DB_KEYSPACE=killrvideo

# Secret key for signing JWTs (use any long random string)
JWT_SECRET_KEY=change-this-to-a-long-random-string

# JWT algorithm and expiry
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

The `JWT_SECRET_KEY` can be any string for local development. In production, use a cryptographically random value of at least 32 characters.

## Initialize the Schema

Run the schema initialization script to create all the required tables in Astra DB:

```bash
poetry run python -m app.db.init_schema
```

This script connects to your Astra DB instance and creates all the tables that KillrVideo needs. It is safe to run multiple times — it will not drop existing tables or data.

You should see output like:

```
Initializing schema...
Creating table: users
Creating table: videos
Creating table: comments
Creating table: ratings
Creating table: tags
Schema initialization complete.
```

## Start the Server

```bash
poetry run uvicorn app.main:app --reload
```

The `--reload` flag enables hot reloading — the server restarts automatically when you change source files, which is useful during development.

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## Verify It's Running

Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser. You will see the Swagger UI with all KillrVideo endpoints documented and explorable interactively.

The API root at [http://localhost:8000](http://localhost:8000) returns a health check response:

```json
{
  "status": "ok",
  "version": "2025.1.0"
}
```

The server is running and connected to Astra DB. Move on to [Your First API Call](/getting-started/first-api-call/) to register a user and make your first authenticated request.
