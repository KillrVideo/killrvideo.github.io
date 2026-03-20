---
title: "GET /api/v1/moderation/flags"
description: "Retrieve the moderation queue, optionally filtered by flag status"
endpoint: "/api/v1/moderation/flags"
method: "GET"
spec_artifact: "/services/moderation/_specs/get-flags.spec.md"
concepts:
  - role-based-access-control
  - sai-filtered-queries
  - pagination
  - moderation-workflows
order: 3
draft: true
---

# GET /api/v1/moderation/flags - Moderation Queue

## Overview

This endpoint returns the list of content flags for moderator review. It is the primary entry point for the moderation workflow: moderators visit the queue, see which content has been flagged, and decide which items to act on.

**Why it exists**: Moderators need a way to see everything that requires attention. This endpoint provides that view with optional filtering by status so moderators can focus on new items (`open`), items already being reviewed (`under_review`), or review resolved items (`approved`/`rejected`) for auditing purposes.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/moderation/flags`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by FlagStatusEnum: `open`, `under_review`, `approved`, `rejected` |
| `page` | integer | No | Page number (default: 1) |
| `page_size` | integer | No | Items per page (default: 20, max: 100) |

### Response Body (200)

```json
{
  "items": [
    {
      "flagId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "11111111-2222-3333-4444-555555555555",
      "contentType": "video",
      "contentId": "550e8400-e29b-41d4-a716-446655440000",
      "reasonCode": "spam",
      "reasonText": "Fake giveaway scam.",
      "status": "open",
      "createdAt": "2025-11-01T14:22:00Z",
      "updatedAt": "2025-11-01T14:22:00Z",
      "moderatorId": null,
      "moderatorNotes": null,
      "resolvedAt": null
    }
  ],
  "total": 47,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

## Cassandra Concepts Explained

### Role-Based Access Control (RBAC)

Not all authenticated users should have access to every endpoint. The moderation queue contains sensitive information (who flagged what, moderator notes) that regular viewers should not see.

KillrVideo implements RBAC using JWT claims. When a moderator logs in, their token includes a `roles` claim:

```json
{
  "sub": "11111111-...",
  "roles": ["viewer", "moderator"],
  "exp": 1735689600
}
```

The endpoint's auth middleware checks for the `moderator` role. If the claim is absent, the request is rejected with a 403 before any database work happens.

This is application-layer RBAC — the database itself doesn't know about roles. The access control lives entirely in the API service.

### SAI Filtered Queries

Without the `status` filter, returning all flags requires reading all rows in the `flags` table — a full table scan. With a high volume of flags, this becomes prohibitively slow.

The SAI (Storage-Attached Index) on the `status` column solves this. SAI lets you filter on non-primary-key columns efficiently:

```cql
-- Without SAI: would be ALLOW FILTERING (table scan)
SELECT * FROM killrvideo.flags WHERE status = 'open';

-- With SAI on status: efficient index scan
-- The above query works efficiently because of the SAI index
```

**Why SAI over a denormalized table**:
- A denormalized approach (`flags_by_status` table) would require updating two tables every time status changes — complex and error-prone
- SAI maintains one source of truth (`flags` table) and keeps the index up to date automatically

### Moderation Workflows

A well-designed moderation system has clear status transitions:

```
open       → Item needs attention, hasn't been claimed
under_review → A moderator is actively reviewing this item
approved   → Moderator confirmed the flag is valid (content removed/acted on)
rejected   → Moderator dismissed the flag (content is acceptable)
```

Filtering by status maps directly to different moderator workflows:
- `status=open` → New items to pick up
- `status=under_review` → Items currently being worked on
- `status=approved` or `status=rejected` → Audit log of past decisions

### Pagination

The `flags` table can grow very large over time. Returning all records in one response is impractical. The endpoint uses cursor-based or offset-based pagination to return manageable pages.

Cassandra's native paging mechanism (page state tokens) is preferred over SQL-style `OFFSET`, which would require skipping rows by scanning. The Astra Data API handles this via the `nextPageState` token pattern.

## Data Model

### Table: `flags`

```cql
CREATE TABLE killrvideo.flags (
    flagid     uuid PRIMARY KEY,
    userid     uuid,
    contenttype text,
    contentid  uuid,
    reasoncode text,
    reasontext text,
    status     text,       -- Filtered by this endpoint
    createdat  timestamp,
    updatedat  timestamp,
    moderatorid  uuid,
    moderatornotes text,
    resolvedat   timestamp
);

-- Required for this endpoint's status filter
CREATE CUSTOM INDEX flags_status_idx
ON killrvideo.flags(status)
USING 'StorageAttachedIndex';
```

## Database Queries

### Without Status Filter (All Flags)

```python
async def get_all_flags(page: int, page_size: int):
    flags_table = await get_table("flags")
    results = await flags_table.find(
        filter={},
        limit=page_size,
        skip=(page - 1) * page_size
    )
    return list(results)
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.flags LIMIT 20;
```

**Note**: Without a filter, this reads all partitions. Acceptable for small datasets; add Cassandra-native paging tokens for large ones.

### With Status Filter

```python
async def get_flags_by_status(status: str, page: int, page_size: int):
    flags_table = await get_table("flags")
    results = await flags_table.find(
        filter={"status": status},
        limit=page_size,
        skip=(page - 1) * page_size
    )
    return list(results)
```

**Equivalent CQL**:
```cql
-- Efficient because of SAI index on status
SELECT * FROM killrvideo.flags WHERE status = 'open' LIMIT 20;
```

**Performance**: SAI index scan — much faster than full table scan for selective status values.

### Count for Pagination Metadata

```python
async def count_flags_by_status(status: str):
    flags_table = await get_table("flags")
    # Count requires aggregation — use estimated count or separate counter table
    return await flags_table.count_documents(filter={"status": status})
```

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends GET /api/v1/moderation/flags            │
│    ?status=open&page=1&page_size=20                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires moderator role                           │
│    └─ Returns 403 if role absent                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Parse and validate query parameters                  │
│    ├─ status must be valid FlagStatusEnum (if provided) │
│    ├─ page ≥ 1                                          │
│    └─ page_size 1–100                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Query flags table                                    │
│    ├─ If status provided: filter via SAI index          │
│    └─ If no status: return all flags (paginated)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Return 200 PaginatedResponse                         │
│    {items, total, page, pageSize, hasMore}              │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Moderator Role is Strictly Enforced

This endpoint returns data about users who submitted flags. Even other authenticated users (non-moderators) must not access this. The 403 response should not reveal why access was denied (no "you need moderator role" message) to avoid information leakage about the permission model.

### 2. SAI Performance Characteristics

SAI index efficiency depends on selectivity. For `status`:
- `"open"` is typically the most common status (flags pile up faster than they're reviewed)
- `"under_review"` is usually sparse (only items actively being processed)
- `"approved"` and `"rejected"` grow over time but moderators rarely query these

For large deployments, consider partitioning by `(status, date_bucket)` if a single status value accumulates millions of rows.

### 3. Eventual Consistency

Because Cassandra is eventually consistent, a flag submitted moments ago might not appear immediately in this list. Under normal conditions the lag is milliseconds, but under heavy write load it can be longer. The moderation queue is not a real-time dashboard — slight delays are acceptable.

### 4. Pagination Approaches

The Astra Data API supports:
- **Offset pagination** (`skip`/`limit`): Simple, but slow for large offsets
- **Page state tokens**: Efficient cursor-based pagination for deep pages

For a moderation queue, moderators typically work from the first page (newest/oldest items). Offset pagination is acceptable for this use case.

## Developer Tips

### Common Pitfalls

1. **Skipping the role check**: If auth middleware is misconfigured, this endpoint could leak flag data to regular users. Always verify the moderator role is enforced, not just authentication.

2. **Missing SAI index**: Without `flags_status_idx`, every filtered request does a full table scan. Verify the index exists in your keyspace before testing.

3. **Returning full text in list views**: `reasonText` can be 500 characters. In a list view with many items, this is significant payload. Consider truncating in list responses and returning full text only in the detail endpoint.

4. **Not handling empty results**: When no flags match the filter, return `{"items": [], "total": 0, "hasMore": false}` — not a 404.

### Query Performance Expectations

| Query Type | Performance | Why |
|------------|-------------|-----|
| All flags (no filter) | 10–50ms | Sequential scan, depends on table size |
| Filter by status (SAI) | < 20ms | Index scan, efficient for selective values |
| Single page read | < 30ms | Pagination limits data transfer |

## Related Endpoints

- [POST /api/v1/flags](/services/moderation/post-flag/) - Submit a new flag
- [POST /api/v1/moderation/flags/{flag_id}/action](/services/moderation/post-flag-action/) - Act on a flag from the queue
- [GET /api/v1/moderation/flags/{flag_id}](/services/moderation/get-flag-details/) - Drill into a specific flag
