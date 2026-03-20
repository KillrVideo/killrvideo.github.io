---
title: "POST /api/v1/flags"
description: "Submit a content flag for moderator review"
endpoint: "/api/v1/flags"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-flag.spec.md"
concepts:
  - composite-primary-keys
  - status-tracking
  - content-moderation-data-modeling
  - uuid-generation
order: 2
draft: true
---

# POST /api/v1/flags - Submit a Content Flag

## Overview

This endpoint allows authenticated viewers to flag a video or comment for moderator review. When a user spots spam, inappropriate content, harassment, or copyright violations, they submit a flag that enters the moderation queue.

**Why it exists**: Community-driven moderation is essential for large-scale video platforms. Rather than relying entirely on automated systems, KillrVideo allows users to report problematic content so human moderators can review and act on it. This creates an auditable trail of who flagged what, why, and what happened next.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/flags`
- **Auth Required**: Yes (viewer role minimum)
- **Success Status**: 201 Created

### Request Body

```json
{
  "contentType": "video",
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "reasonCode": "spam",
  "reasonText": "This video is promoting a fake giveaway scam."
}
```

**Field rules**:
- `contentType`: Must be `"video"` or `"comment"`
- `contentId`: UUID of the content being flagged
- `reasonCode`: One of `spam`, `inappropriate`, `harassment`, `copyright`, `other`
- `reasonText`: Optional free-text detail, max 500 characters

### Response Body (201)

```json
{
  "flagId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "11111111-2222-3333-4444-555555555555",
  "contentType": "video",
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "reasonCode": "spam",
  "reasonText": "This video is promoting a fake giveaway scam.",
  "status": "open",
  "createdAt": "2025-11-01T14:22:00Z",
  "updatedAt": "2025-11-01T14:22:00Z",
  "moderatorId": null,
  "moderatorNotes": null,
  "resolvedAt": null
}
```

Note the nullable fields (`moderatorId`, `moderatorNotes`, `resolvedAt`) that are only populated once a moderator acts on the flag.

## Cassandra Concepts Explained

### Composite Primary Keys

The `flags` table uses `flagid` as its sole partition key. Each flag gets a unique UUID, making lookups by flag ID extremely fast. This is a deliberate choice: moderators primarily look up flags by ID or filter by status, not by who submitted them or what content they point to.

A composite key design (e.g., `(contentType, contentId, flagId)`) would optimize for "all flags on a given video" but would complicate moderator queue queries. The current design prioritizes the moderation workflow.

### Status Tracking

Flags move through a well-defined state machine:

```
open → under_review → approved
                    → rejected
```

The `status` field is indexed with SAI, which makes filtering the moderation queue by status efficient. Without SAI, filtering by status would require a full table scan or a separate denormalized table per status.

### Data Modeling for Audit Trails

Moderation data is inherently audit-oriented: you want to know not just the current state but the full history. The `flags` table captures:

- **Who** flagged (`userId`)
- **What** was flagged (`contentType`, `contentId`)
- **Why** it was flagged (`reasonCode`, `reasonText`)
- **When** it was flagged (`createdAt`)
- **Who reviewed it** (`moderatorId`)
- **What they decided** (`status`, `moderatorNotes`)
- **When it was resolved** (`resolvedAt`)

All of this lives in a single row, making the complete audit trail accessible with a single partition key lookup.

## Data Model

### Table: `flags`

```cql
CREATE TABLE killrvideo.flags (
    flagid     uuid PRIMARY KEY,       -- Partition key: unique flag identifier
    userid     uuid,                   -- Who submitted the flag
    contenttype text,                  -- "video" or "comment"
    contentid  uuid,                   -- What was flagged
    reasoncode text,                   -- Reason category
    reasontext text,                   -- Optional free-text explanation
    status     text,                   -- "open", "under_review", "approved", "rejected"
    createdat  timestamp,
    updatedat  timestamp,
    moderatorid  uuid,                 -- Which moderator handled this
    moderatornotes text,               -- Moderator's decision notes
    resolvedat   timestamp
);

-- SAI index for filtering by status in the moderation queue
CREATE CUSTOM INDEX flags_status_idx
ON killrvideo.flags(status)
USING 'StorageAttachedIndex';

-- SAI index for filtering by content being flagged
CREATE CUSTOM INDEX flags_contentid_idx
ON killrvideo.flags(contentid)
USING 'StorageAttachedIndex';
```

**Key characteristics**:
- **Partition Key**: `flagid` (UUID v4) — each flag is an independent partition
- **SAI on `status`**: Powers the moderation queue filtered by status
- **SAI on `contentid`**: Allows looking up all flags against a specific video or comment

## Database Queries

### 1. Insert New Flag

```python
async def create_flag(current_user, flag_in: FlagCreateRequest):
    flags_table = await get_table("flags")

    flag_id = uuid4()
    now = datetime.now(timezone.utc)

    flag_document = {
        "flagid": str(flag_id),
        "userid": str(current_user.userid),
        "contenttype": flag_in.contentType,
        "contentid": str(flag_in.contentId),
        "reasoncode": flag_in.reasonCode,
        "reasontext": flag_in.reasonText,
        "status": "open",
        "createdat": now.isoformat(),
        "updatedat": now.isoformat(),
        "moderatorid": None,
        "moderatornotes": None,
        "resolvedat": None
    }

    await flags_table.insert_one(document=flag_document)
    return flag_document
```

**Equivalent CQL**:
```cql
INSERT INTO killrvideo.flags (
    flagid, userid, contenttype, contentid, reasoncode, reasontext,
    status, createdat, updatedat, moderatorid, moderatornotes, resolvedat
) VALUES (
    a1b2c3d4-e5f6-7890-abcd-ef1234567890,
    11111111-2222-3333-4444-555555555555,
    'video',
    550e8400-e29b-41d4-a716-446655440000,
    'spam',
    'This video is promoting a fake giveaway scam.',
    'open',
    '2025-11-01T14:22:00Z',
    '2025-11-01T14:22:00Z',
    null, null, null
);
```

**Performance**: O(1) — single partition write

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends POST /api/v1/flags                      │
│    {contentType, contentId, reasonCode, reasonText?}    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires viewer role (minimum)                    │
│    └─ Extracts userId from token claims                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate request body (Pydantic)                     │
│    ├─ contentType must be "video" or "comment"          │
│    ├─ contentId must be a valid UUID                    │
│    ├─ reasonCode must be a valid enum value             │
│    └─ reasonText length ≤ 500 characters                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Build flag document                                  │
│    ├─ flagId = uuid4()                                  │
│    ├─ status = "open"                                   │
│    └─ createdAt = updatedAt = now()                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. INSERT INTO flags                                    │
│    └─ Single row write                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Return 201 with FlagResponse                         │
│    (includes null fields for moderator data)            │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Initial Status is Always "open"

The API ignores any `status` field the client might send. A newly created flag is always `"open"`. This prevents clients from pre-approving or pre-rejecting their own flags.

### 2. Nullable Moderator Fields

Fields like `moderatorId`, `moderatorNotes`, and `resolvedAt` are explicitly `null` at creation time. This is intentional — the schema is designed for the full lifecycle of a flag, not just its initial state. Returning them as `null` upfront makes the response shape consistent regardless of flag state.

### 3. Duplicate Flag Handling

The current design allows a user to flag the same content multiple times (each gets a unique `flagId`). A production system might enforce one-flag-per-user-per-content using an additional SAI index or by checking before inserting:

```python
# Optional: check if user already flagged this content
existing = await flags_table.find_one(filter={
    "userid": str(current_user.userid),
    "contentid": str(flag_in.contentId)
})
if existing:
    raise HTTPException(status_code=409, detail="Content already flagged by this user")
```

### 4. Content Existence Not Verified

The endpoint does not verify that `contentId` actually refers to an existing video or comment. This is a deliberate trade-off for performance: cross-table lookups for every flag submission would add latency. Invalid content IDs simply result in orphaned flags that moderators can dismiss.

## Developer Tips

### Common Pitfalls

1. **Forgetting to set initial status**: Always set `status = "open"` on creation; never trust client-supplied status.

2. **Not indexing status**: Without the SAI index on `status`, the moderation queue endpoint would require a full table scan on every request.

3. **Storing raw UUIDs vs strings**: The Astra Data API requires UUIDs serialized as strings. Use `str(uuid4())` before inserting.

4. **Large reasonText**: Enforce the 500-character limit at the Pydantic layer, not just in documentation. Oversized text fields slow down row serialization.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Insert flag | < 5ms | Single partition write |
| Lookup by flagId | < 5ms | Partition key lookup |
| Filter queue by status | < 20ms | SAI index scan |

## Related Endpoints

- [GET /api/v1/moderation/flags](/services/moderation/get-flags/) - View the moderation queue
- [POST /api/v1/moderation/flags/{flag_id}/action](/services/moderation/post-flag-action/) - Take moderator action on a flag
- [GET /api/v1/moderation/flags/{flag_id}](/services/moderation/get-flag-details/) - Get details of a specific flag
