---
title: Data Modeling
order: 1
description: Cassandra and Astra DB data modeling primer
---

# Data Modeling with Cassandra & Astra DB

Cassandra data modeling is different from relational data modeling. In a relational database, you normalize data into tables and write queries that join them. In Cassandra, you model your tables around your queries and duplicate data deliberately. This page explains the core concepts you need to understand the decisions made throughout KillrVideo.

## Partition Keys

Every Cassandra table has a **partition key** — one or more columns that determine where data is physically stored. All rows with the same partition key live on the same node (or set of nodes in a replication factor). This is the fundamental unit of data locality.

The partition key rule is strict: to query efficiently, your query must include the partition key in its WHERE clause. Queries that don't specify the partition key require a full table scan, which is expensive and generally avoided.

In the `users` table, the partition key is `user_id`. If you want to look up a user, you must provide their user ID. This is why KillrVideo doesn't support "find users by email" as a simple lookup — instead, there is a separate `users_by_email` table with `email` as the partition key, specifically to support login queries.

## Clustering Columns

Within a partition, rows are ordered by **clustering columns**. These define the sort order of rows inside a partition and enable efficient range queries within a partition.

A practical example: a video's comments are stored in a partition keyed by `video_id`, with `comment_id` (a time-based UUID) as the clustering column in descending order. This means "get the 20 most recent comments for video X" is a single efficient partition read — no sorting, no scanning unrelated data.

## Denormalization

In relational databases, storing the same data in multiple places is a mistake. In Cassandra, it is the solution.

Because Cassandra does not support joins, and because you must query by partition key, you often need to store the same data in multiple tables shaped for different queries. This is called **denormalization** or query-driven design.

KillrVideo demonstrates this throughout. A video's basic metadata (title, user_id, created_at) appears in the `videos` table (partitioned by video_id for direct lookups) and also in a `latest_videos` table (partitioned by a time bucket for feed queries). When a video is created, both tables are written. This duplication is intentional and expected.

The tradeoff: writes are slightly more expensive (multiple table writes per operation), but reads are extremely fast (single partition, no joins).

## SAI: Storage-Attached Indexes

**SAI (Storage-Attached Indexes)** are Astra DB's modern secondary indexing mechanism. They allow you to query columns that are not part of the partition key, without requiring a separate query table.

SAI indexes are appropriate when:

- You need to filter by a non-partition-key column
- The column has reasonable cardinality (not too few distinct values)
- You can tolerate slightly slower writes (the index must be updated on write)

KillrVideo uses SAI on the `videos` table to support keyword search by title and tag filtering. Without SAI, these queries would require maintaining separate tables. With SAI, a single `videos` table serves both direct lookups (by `video_id`) and filtered searches.

SAI differs from older Cassandra secondary indexes in that it is stored alongside the data on each node, making it much more performant at scale.

## UUIDs Instead of Auto-Increment

Cassandra uses UUIDs as identifiers instead of auto-incrementing integers. The reason is distribution: in a multi-node cluster, there is no central authority to issue sequential IDs. UUIDs are generated independently by the application and are statistically guaranteed to be unique.

KillrVideo uses two UUID types:

- **UUID v4** (`uuid`): randomly generated, used for user IDs and video IDs
- **UUID v1** (`timeuuid`): time-based, used for comments and events where chronological ordering matters. A timeuuid encodes the timestamp, so rows with timeuuid clustering columns are automatically ordered by creation time.

## Data Types

Cassandra's type system is richer than it might seem. Types used in KillrVideo:

| Type | Use in KillrVideo |
|---|---|
| `text` | Names, titles, descriptions, tags |
| `uuid` | User IDs, video IDs |
| `timeuuid` | Comment IDs, event IDs (time-ordered) |
| `timestamp` | Created/updated timestamps |
| `set<text>` | Tags on a video (unordered, deduplicated) |
| `map<text, text>` | Metadata key-value pairs |
| `vector<float, 4096>` | NVIDIA NV-Embed-QA embeddings for semantic search |

The `vector` type is specific to Astra DB and enables approximate nearest neighbor (ANN) queries directly in the database.

## Example: The Users Table

The `users` table illustrates several of these concepts together:

```sql
CREATE TABLE users (
    user_id    uuid,
    email      text,
    first_name text,
    last_name  text,
    password_hash text,
    roles      set<text>,
    created_at timestamp,
    PRIMARY KEY (user_id)
);
```

- `user_id` is the partition key — every lookup is by user ID.
- `email` is stored here but not queryable as a key. A separate `users_by_email` table handles email lookups for login.
- `roles` is a `set<text>` — a user can have multiple roles, and the set type handles deduplication.
- No auto-increment — `user_id` is a UUID v4 generated by the application at registration time.

This is query-driven design: the table is shaped for the most common operation (look up a user by ID), not for normalization.
