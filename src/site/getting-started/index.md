---
title: Prerequisites & Setup
order: 1
description: What you need before running KillrVideo
---

# Prerequisites & Setup

Before you run KillrVideo locally, you need a few things installed and a free Astra DB account. This page walks you through getting everything in place.

## What You Need

**Python 3.11 or later**

KillrVideo uses Python features from 3.11. Check your version:

```bash
python3 --version
```

If you need to install or upgrade Python, use [python.org](https://www.python.org/downloads/) or your system package manager.

**Poetry**

Poetry manages Python dependencies and virtual environments. Install it with:

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

Verify with `poetry --version`. See the [Poetry documentation](https://python-poetry.org/docs/) for alternative installation methods.

**Git**

You will need Git to clone the repository. Verify with `git --version`. Install from [git-scm.com](https://git-scm.com/) if needed.

## Create a DataStax Astra DB Account

KillrVideo uses Astra DB as its database. Astra DB is a cloud-managed Cassandra service with a free tier that is sufficient for running KillrVideo and experimenting with all its features.

1. Go to [astra.datastax.com](https://astra.datastax.com) and sign up for a free account.
2. Once logged in, click **Create Database**.
3. Choose **Serverless (Vector)** as the database type — this supports both standard Cassandra tables and vector search.
4. Give your database a name (e.g., `killrvideo`) and choose a cloud provider and region close to you.
5. Wait for the database status to show **Active** (usually under a minute).

## Get Your Astra Credentials

KillrVideo needs three pieces of information from Astra DB:

**Application Token**

In your Astra dashboard, navigate to your database and click **Generate Token**. Choose the **Database Administrator** role. Copy the token — it starts with `AstraCS:`. You will only see the full token once, so store it somewhere safe.

**API Endpoint**

On the database overview page, find the **API Endpoint** field. It looks like:

```
https://<database-id>-<region>.apps.astra.datastax.com
```

Copy this URL.

**Keyspace Name**

A keyspace is Cassandra's namespace for tables. When you created your database, Astra created a default keyspace with the same name as your database. You can find the keyspace name on the database overview page under the **Keyspace** section. You can also create a new keyspace if you prefer.

## About the Python Backend

KillrVideo 2025 is documented and referenced through the Python (FastAPI) implementation. The API contract — endpoints, request shapes, response shapes — is the same regardless of implementation language. If a KillrVideo implementation exists in another language, it will expose the same REST API described in these docs.

The Python repository is:
[github.com/KillrVideo/kv-be-python-fastapi-dataapi-table](https://github.com/KillrVideo/kv-be-python-fastapi-dataapi-table)

Once you have your Astra credentials and the prerequisites installed, move on to [Run the Application](/getting-started/run-the-app/) to clone the repo and get it running.
