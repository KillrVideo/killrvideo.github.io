---
title: "GET /api/v1/moderation/flags/{flag_id}"
description: "Retrieve full details for a specific content flag"
endpoint: "/api/v1/moderation/flags/{flag_id}"
method: "GET"
spec_artifact: "/services/moderation/_specs/get-flag-details.spec.md"
concepts:
  - partition-key-lookup
  - moderator-only-access
  - single-row-retrieval
order: 5
draft: true
---

# GET /api/v1/moderation/flags/{flag_id} - Flag Details

## Overview

This endpoint retrieves the complete record for a single content flag by its ID. It is used when a moderator needs to examine all the details of a flag before taking action, or when reviewing the history of how a flag was handled.

**Why it exists**: The queue view ([GET /api/v1/moderation/flags](/services/moderation/get-flags/)) provides a summary list. This endpoint provides the full record — including moderator notes and resolution history — for a single flag. Separating list from detail is a common API pattern that keeps list responses lightweight while still providing full information when needed.

## HTTP Details

- **Method**: GET
- **Path**: `/api/v1/moderation/flags/{flag_id}`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `flag_id` | uuid | Unique identifier of the flag |

### Response Body (200)

```json
{
  "flagId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "11111111-2222-3333-4444-555555555555",
  "contentType": "video",
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "reasonCode": "spam",
  "reasonText": "This video is promoting a fake giveaway scam targeting children.",
  "status": "under_review",
  "createdAt": "2025-11-01T14:22:00Z",
  "updatedAt": "2025-11-02T08:45:00Z",
  "moderatorId": "99999999-8888-7777-6666-555555555555",
  "moderatorNotes": "Reviewing - potential brand impersonation as well.",
  "resolvedAt": null
}
```

## Cassandra Concepts Explained

### Partition Key Lookup

The single most important performance characteristic of this endpoint is that `flagid` is the partition key of the `flags` table. This means:

1. Cassandra hashes `flagid` to determine which node holds the data
2. The query is routed directly to that node
3. The node returns the single row without scanning any other data

This is **O(1) complexity** — it takes the same time whether the table has 100 rows or 100 million rows. This is the foundational access pattern in Cassandra data modeling: design your tables so that your most critical queries use the partition key.

Compare this to a query like `WHERE status = 'open'`, which requires a SAI index to avoid a full table scan. Partition key lookups are always faster and require no additional infrastructure.

### Why This Endpoint is Simple

Unlike many endpoints, this one involves a single database operation: a partition key lookup. No joins (Cassandra has none), no aggregations, no index scans. The simplicity is a feature of good data modeling — `flagid` is both the identifier clients reference and the partition key, so lookups are trivially efficient.

### Moderator-Only Access

Even though this is a read-only endpoint, it requires moderator role. The flag record includes sensitive information:
- Who submitted the flag (`userId`)
- The full reason text (which might contain personal information)
- Internal moderator notes

Regular viewers should not be able to look up flags by ID, even their own. This prevents users from monitoring the status of flags they've submitted (which could inform adversarial behavior) and protects the privacy of flag submitters from other users.

## Data Model

### Table: `flags`

```cql
CREATE TABLE killrvideo.flags (
    flagid        uuid PRIMARY KEY,   -- Partition key: direct lookup
    userid        uuid,
    contenttype   text,
    contentid     uuid,
    reasoncode    text,
    reasontext    text,
    status        text,
    createdat     timestamp,
    updatedat     timestamp,
    moderatorid   uuid,
    moderatornotes text,
    resolvedat    timestamp
);
```

No additional indexes are needed for this query — the partition key is sufficient.

## Database Queries

### Fetch Flag by ID

```python
async def get_flag_details(flag_id: str):
    flags_table = await get_table("flags")

    flag = await flags_table.find_one(
        filter={"flagid": flag_id}
    )

    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    return flag
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.flags
WHERE flagid = a1b2c3d4-e5f6-7890-abcd-ef1234567890;
```

**Performance**: O(1) — direct partition key lookup, typically under 5ms

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. GET /api/v1/moderation/flags/{flag_id}               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires moderator role                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate path parameter                              │
│    └─ flag_id must be valid UUID format                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. SELECT * FROM flags WHERE flagid = ?                 │
│    ├─ If found: return 200 with FlagResponse            │
│    └─ If not found: return 404                          │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Response Shape is Identical to List Items

The `FlagResponse` schema is the same here as in the queue list endpoint. This consistency is intentional — client code can use the same model to render a list item or a detail view without transformations.

### 2. No Caching

Flags are mutable (status changes, moderator notes are added). Caching flag details could serve stale data to a moderator who is actively working a flag. For this use case, always fetch fresh from the database.

### 3. UUID Validation Before Query

Validating that `flag_id` is a properly formatted UUID before querying avoids sending malformed queries to the database. Pydantic's `UUID` type handles this:

```python
from uuid import UUID
from fastapi import Path

async def get_flag_details(
    flag_id: UUID = Path(..., description="Flag UUID")
):
    # flag_id is already validated as UUID before reaching here
    ...
```

### 4. 404 vs 403 Priority

If the flag exists but the requester doesn't have moderator role, should they get a 403 or 404? Best practice is to return 403 (auth failure detected at middleware, before the DB query runs) rather than 404, because:
- The auth check happens before the database lookup
- Returning 404 to mask existence would require an extra DB query
- Moderator role is checked universally for all moderation endpoints

## Developer Tips

### Common Pitfalls

1. **Accepting non-UUID path parameters**: If `flag_id` is not validated as a UUID, a client could pass arbitrary strings that trigger unexpected database behavior. Use Pydantic's `UUID` type.

2. **Returning 200 with null body**: When a flag is not found, return 404 — not 200 with `null` or an empty object.

3. **Exposing this to non-moderators**: Even if someone knows a `flagId`, they should not be able to look it up without moderator role.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Lookup by flagId | < 5ms | Partition key lookup |
| Total request | < 15ms | Auth check + single DB query |

## Related Endpoints

- [GET /api/v1/moderation/flags](/services/moderation/get-flags/) - List all flags (use to find flag IDs)
- [POST /api/v1/moderation/flags/{flag_id}/action](/services/moderation/post-flag-action/) - Act on this flag
- [POST /api/v1/flags](/services/moderation/post-flag/) - How a flag is originally submitted
