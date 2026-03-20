---
title: "Deployment Patterns"
description: "How to deploy KillrVideo locally and in production — local dev with uvicorn, Docker, cloud environments, and Astra DB connection configuration"
order: 3
draft: true
---

# Deployment Patterns

## Overview

KillrVideo is a FastAPI Python application that connects to Astra DB (DataStax's cloud-native Cassandra service). This page covers how to run it in different environments: local development, Docker, and cloud deployments.

---

## Environment Variables

All KillrVideo deployments are configured through environment variables. No credentials should be hardcoded.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ASTRA_DB_APPLICATION_TOKEN` | Astra DB authentication token | `AstraCS:abc123...` |
| `ASTRA_DB_API_ENDPOINT` | Your Astra DB API endpoint URL | `https://<uuid>-<region>.apps.astra.datastax.com` |
| `ASTRA_DB_KEYSPACE` | Cassandra keyspace to use | `killrvideo` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens | `your-256-bit-secret` |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `JWT_EXPIRY_MINUTES` | Token lifetime in minutes | `60` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASTRA_DB_NAMESPACE` | Alternative to ASTRA_DB_KEYSPACE | — |
| `NVIDIA_API_KEY` | For direct NVIDIA embedding calls | — |
| `LOG_LEVEL` | Logging verbosity | `INFO` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `*` |

### `.env` File for Local Development

Create a `.env` file in the project root (never commit this file):

```env
ASTRA_DB_APPLICATION_TOKEN=AstraCS:your_token_here
ASTRA_DB_API_ENDPOINT=https://your-db-id-us-east1.apps.astra.datastax.com
ASTRA_DB_KEYSPACE=killrvideo
JWT_SECRET_KEY=change-this-to-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=60
```

The application uses `python-dotenv` to load this file automatically:

```python
from dotenv import load_dotenv
load_dotenv()
```

Your `.gitignore` should always include `.env`:
```
.env
.env.local
.env.*.local
```

---

## Local Development with uvicorn

[uvicorn](https://www.uvicorn.org/) is a fast ASGI server used to run FastAPI applications in development and production.

### Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template and fill in values
cp .env.example .env
# Edit .env with your Astra DB credentials
```

### Running the Development Server

```bash
# Development mode with auto-reload on file changes
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Flags:
- `--reload`: Restart server automatically when Python files change (development only)
- `--host 0.0.0.0`: Accept connections from any interface (use `127.0.0.1` for localhost-only)
- `--port 8000`: Port to listen on

### Accessing the API

Once running, the API is available at:
- API: `http://localhost:8000`
- Interactive docs (Swagger UI): `http://localhost:8000/docs`
- Alternative docs (ReDoc): `http://localhost:8000/redoc`
- OpenAPI schema: `http://localhost:8000/openapi.json`

### Development Tips

```bash
# Run with verbose logging
uvicorn app.main:app --reload --log-level debug

# Run with multiple workers (for load testing locally)
uvicorn app.main:app --workers 4 --port 8000

# Run with custom timeout
uvicorn app.main:app --reload --timeout-keep-alive 30
```

---

## Docker Deployment

Docker provides consistent, reproducible deployments across environments.

### Dockerfile

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose API port
EXPOSE 8000

# Run with uvicorn (no --reload in production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### Building the Image

```bash
# Build
docker build -t killrvideo-api:latest .

# Build with a specific tag
docker build -t killrvideo-api:v1.2.0 .
```

### Running the Container

```bash
# Run with environment variables from .env file
docker run -d \
  --name killrvideo-api \
  --env-file .env \
  -p 8000:8000 \
  killrvideo-api:latest

# Run with explicit environment variables
docker run -d \
  --name killrvideo-api \
  -e ASTRA_DB_APPLICATION_TOKEN=AstraCS:... \
  -e ASTRA_DB_API_ENDPOINT=https://... \
  -e ASTRA_DB_KEYSPACE=killrvideo \
  -e JWT_SECRET_KEY=your-secret \
  -p 8000:8000 \
  killrvideo-api:latest
```

### Docker Compose

For local development with multiple services (e.g., API + a mock auth service):

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - LOG_LEVEL=debug
    volumes:
      - ./app:/app/app  # Mount source for live reload
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    restart: unless-stopped
```

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f api

# Stop services
docker compose down
```

---

## Astra DB Connection Configuration

### Obtaining Credentials

1. Log in to [Astra DB console](https://astra.datastax.com)
2. Create or select a database
3. Generate an application token (Database Administrator role for development)
4. Copy the API endpoint from the database overview page

### Connection in Code

KillrVideo uses the `astrapy` library to connect to Astra DB:

```python
from astrapy import DataAPIClient
from astrapy.constants import Environment
import os

def get_astra_client() -> DataAPIClient:
    token = os.environ["ASTRA_DB_APPLICATION_TOKEN"]
    endpoint = os.environ["ASTRA_DB_API_ENDPOINT"]

    client = DataAPIClient(token=token)
    database = client.get_database(endpoint)

    return database

async def get_table(table_name: str):
    db = get_astra_client()
    keyspace = os.environ.get("ASTRA_DB_KEYSPACE", "killrvideo")
    return db.get_collection(table_name, keyspace=keyspace)
```

### Connection Pooling

The `astrapy` client handles connection pooling internally. Create a single client instance at application startup and reuse it — don't create a new client on every request:

```python
# app/database.py — singleton client
_db_client = None

def get_database():
    global _db_client
    if _db_client is None:
        client = DataAPIClient(
            token=os.environ["ASTRA_DB_APPLICATION_TOKEN"]
        )
        _db_client = client.get_database(
            os.environ["ASTRA_DB_API_ENDPOINT"]
        )
    return _db_client
```

### Token Permissions

For production, use the minimum required permissions:
- **Development/testing**: Database Administrator (full access)
- **Read-only endpoints**: Read Only User token
- **Production API**: Application User (read/write to specific keyspace)

Never use Organization Administrator tokens in application code.

---

## Cloud Deployment Patterns

### Environment Variable Management

In cloud environments, use the platform's secrets management rather than `.env` files:

**AWS**:
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name killrvideo/astra-token \
  --secret-string "AstraCS:your_token"

# Reference in ECS task definition
{
  "secrets": [
    {
      "name": "ASTRA_DB_APPLICATION_TOKEN",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:123456:secret:killrvideo/astra-token"
    }
  ]
}
```

**Google Cloud**:
```bash
# Store in Secret Manager
echo -n "AstraCS:your_token" | gcloud secrets create astra-token --data-file=-

# Reference in Cloud Run
gcloud run deploy killrvideo-api \
  --set-secrets="ASTRA_DB_APPLICATION_TOKEN=astra-token:latest"
```

**Kubernetes**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: killrvideo-secrets
type: Opaque
stringData:
  ASTRA_DB_APPLICATION_TOKEN: "AstraCS:your_token"
  JWT_SECRET_KEY: "your-jwt-secret"

---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          envFrom:
            - secretRef:
                name: killrvideo-secrets
```

### Health Check Endpoint

Cloud platforms need a health check to verify the service is running. FastAPI makes this trivial:

```python
@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
```

For a deeper health check that verifies database connectivity:

```python
@app.get("/health/ready")
async def readiness_check():
    try:
        db = get_database()
        # Lightweight check — list tables or do a simple query
        await db.command({"listCollections": 1})
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "not ready", "database": str(e)}
        )
```

### Number of Workers

In production, run multiple uvicorn workers to utilize all CPU cores:

```bash
# Use gunicorn to manage multiple uvicorn workers
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 60

# Or with uvicorn directly (limited worker management)
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

**Rule of thumb for workers**: `2 × CPU cores + 1`. For a 2-core instance, use 5 workers.

Note: KillrVideo uses async database operations (`async/await`). Even with a single uvicorn worker, it can handle many concurrent requests while waiting for Astra DB responses. Multiple workers add parallelism for CPU-bound work.

---

## Security Considerations

### Never Expose `.env` Files

The `.env` file contains secrets. Ensure:
- `.env` is in `.gitignore`
- Docker images don't `COPY .env` into the container
- CI/CD pipelines inject secrets as environment variables, not files

### JWT Secret Key

The `JWT_SECRET_KEY` must be:
- At least 256 bits (32 bytes) of entropy
- Randomly generated, not a human-readable phrase
- Different for each environment (dev, staging, production)

Generate a secure key:
```python
import secrets
print(secrets.token_hex(32))  # 64-character hex string
```

### Astra DB Token Rotation

Rotate Astra DB tokens periodically:
1. Generate new token in Astra console
2. Update the secret in your secrets manager
3. Restart/redeploy the application
4. Revoke the old token

---

## Further Learning

- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [uvicorn Documentation](https://www.uvicorn.org/)
- [astrapy Library](https://github.com/datastax/astrapy)
- [Astra DB Getting Started](https://docs.datastax.com/en/astra-db-serverless/get-started/quickstart.html)
- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
