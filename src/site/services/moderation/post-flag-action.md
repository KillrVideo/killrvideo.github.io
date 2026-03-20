---
title: "POST /api/v1/moderation/flags/{flag_id}/action"
description: "Take moderator action on a flagged item, updating its status and adding notes"
endpoint: "/api/v1/moderation/flags/{flag_id}/action"
method: "POST"
spec_artifact: "/services/moderation/_specs/post-flag-action.spec.md"
concepts:
  - state-machine-transitions
  - audit-trail
  - moderator-assignment
  - optimistic-updates
order: 4
draft: true
---

# POST /api/v1/moderation/flags/{flag_id}/action - Take Flag Action

## Overview

This endpoint allows a moderator to change the status of a flag and optionally add notes explaining their decision. It is the core action endpoint for the moderation workflow — the moment a human reviewer makes a decision about flagged content.

**Why it exists**: A flag by itself is just a report. Action on a flag is what drives moderation outcomes: a video gets removed when a flag is approved, a flag gets dismissed when the content is acceptable. This endpoint records the moderator's decision, assigns them as the reviewer, and transitions the flag through the state machine.

## HTTP Details

- **Method**: POST
- **Path**: `/api/v1/moderation/flags/{flag_id}/action`
- **Auth Required**: Yes (moderator role)
- **Success Status**: 200 OK

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `flag_id` | uuid | Unique identifier of the flag to act on |

### Request Body

```json
{
  "status": "approved",
  "moderatorNotes": "Confirmed spam. Video has been removed."
}
```

**Field rules**:
- `status`: Required. Must be a valid FlagStatusEnum: `open`, `under_review`, `approved`, `rejected`
- `moderatorNotes`: Optional. Free text, max 1000 characters

### Response Body (200)

```json
{
  "flagId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "11111111-2222-3333-4444-555555555555",
  "contentType": "video",
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "reasonCode": "spam",
  "reasonText": "Fake giveaway scam.",
  "status": "approved",
  "createdAt": "2025-11-01T14:22:00Z",
  "updatedAt": "2025-11-02T09:15:00Z",
  "moderatorId": "99999999-8888-7777-6666-555555555555",
  "moderatorNotes": "Confirmed spam. Video has been removed.",
  "resolvedAt": "2025-11-02T09:15:00Z"
}
```

Note that `moderatorId` is now populated with the acting moderator's ID, and `resolvedAt` is set when the flag reaches a terminal state (`approved` or `rejected`).

## Cassandra Concepts Explained

### State Machine Transitions

The `status` field on a flag follows a defined state machine:

```
         ┌────────────────┐
         │      open      │  ← Initial state (all new flags)
         └───────┬────────┘
                 │ moderator claims
                 ▼
         ┌────────────────┐
         │  under_review  │  ← Moderator is actively reviewing
         └───────┬────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌─────────────┐
│   approved   │   │  rejected   │  ← Terminal states
└──────────────┘   └─────────────┘
```

The API does not enforce these transitions strictly — a moderator can technically jump straight from `open` to `approved`. However, the `under_review` state is valuable for team coordination: if two moderators both see an `open` flag, they can claim it by setting it to `under_review` before reviewing, preventing duplicate work.

### Audit Trail

Every action on a flag is recorded. The `flags` table captures:
- **Who acted** (`moderatorId` — the currently authenticated moderator)
- **What they decided** (`status` transition + `moderatorNotes`)
- **When they decided** (`updatedAt`, and `resolvedAt` for terminal states)

This audit trail is important for compliance, appeals, and moderator performance reviews.

Note: the current schema stores only the **most recent** moderator action. For a full audit history (every state change logged), you would need a separate `flag_audit_log` table. That is a natural extension for a more complex moderation system.

### Moderator Assignment

When a moderator takes action, their `userId` (extracted from the JWT) is written to the `moderatorId` column. This serves two purposes:

1. **Accountability**: You can see who made each decision
2. **Coordination**: Other moderators can see that someone is already handling a flag

### Partial Updates in Cassandra

Unlike SQL's `UPDATE ... WHERE`, Cassandra updates are actually upserts at the partition level. When updating a flag's status, you update only the columns you want to change:

```cql
UPDATE killrvideo.flags
SET status = 'approved',
    moderatorid = <uuid>,
    moderatornotes = 'Confirmed spam.',
    updatedat = '2025-11-02T09:15:00Z',
    resolvedat = '2025-11-02T09:15:00Z'
WHERE flagid = a1b2c3d4-e5f6-7890-abcd-ef1234567890;
```

Cassandra writes only the specified columns — untouched columns (like `userid`, `contenttype`, `reasoncode`) retain their existing values.

## Data Model

### Table: `flags`

```cql
CREATE TABLE killrvideo.flags (
    flagid        uuid PRIMARY KEY,
    userid        uuid,
    contenttype   text,
    contentid     uuid,
    reasoncode    text,
    reasontext    text,
    status        text,         -- Updated by this endpoint
    createdat     timestamp,
    updatedat     timestamp,    -- Updated by this endpoint
    moderatorid   uuid,         -- Set to acting moderator's ID
    moderatornotes text,        -- Set by this endpoint
    resolvedat    timestamp     -- Set when status is terminal
);
```

## Database Queries

### 1. Fetch Existing Flag

```python
async def get_flag_by_id(flag_id: str):
    flags_table = await get_table("flags")
    flag = await flags_table.find_one(filter={"flagid": flag_id})
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag
```

**Equivalent CQL**:
```cql
SELECT * FROM killrvideo.flags WHERE flagid = a1b2c3d4-e5f6-7890-abcd-ef1234567890;
```

**Performance**: O(1) — direct partition key lookup

### 2. Update Flag with Moderator Action

```python
async def apply_flag_action(
    flag_id: str,
    moderator_id: str,
    action: FlagUpdateRequest
):
    flags_table = await get_table("flags")
    now = datetime.now(timezone.utc)

    update_doc = {
        "status": action.status,
        "moderatorid": moderator_id,
        "moderatornotes": action.moderatorNotes,
        "updatedat": now.isoformat()
    }

    # Set resolvedAt only for terminal states
    if action.status in ("approved", "rejected"):
        update_doc["resolvedat"] = now.isoformat()

    await flags_table.update_one(
        filter={"flagid": flag_id},
        update={"$set": update_doc}
    )
```

**Equivalent CQL**:
```cql
UPDATE killrvideo.flags
SET status = 'approved',
    moderatorid = 99999999-8888-7777-6666-555555555555,
    moderatornotes = 'Confirmed spam. Video has been removed.',
    updatedat = '2025-11-02T09:15:00Z',
    resolvedat = '2025-11-02T09:15:00Z'
WHERE flagid = a1b2c3d4-e5f6-7890-abcd-ef1234567890;
```

**Performance**: O(1) — direct partition key update

## Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. POST /api/v1/moderation/flags/{flag_id}/action       │
│    {status, moderatorNotes?}                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Auth middleware verifies JWT                         │
│    └─ Requires moderator role                           │
│    └─ Extracts moderatorId from token claims            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Validate path parameter and request body             │
│    ├─ flag_id must be valid UUID format                 │
│    ├─ status must be valid FlagStatusEnum               │
│    └─ moderatorNotes length ≤ 1000 characters           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Fetch flag to verify it exists                       │
│    └─ Returns 404 if flagId not found                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Build update document                                │
│    ├─ Set status, moderatorId, moderatorNotes           │
│    ├─ Set updatedAt = now()                             │
│    └─ If terminal status: set resolvedAt = now()        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. UPDATE flags WHERE flagid = ?                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Return 200 with updated FlagResponse                 │
└─────────────────────────────────────────────────────────┘
```

## Special Notes

### 1. Terminal State Detection

`resolvedAt` is only set when `status` moves to `approved` or `rejected`. If a moderator sets status to `under_review`, `resolvedAt` is left null (or the existing value is preserved if previously set — though logically a flag shouldn't re-open after resolution).

```python
TERMINAL_STATUSES = {"approved", "rejected"}
if action.status in TERMINAL_STATUSES:
    update_doc["resolvedat"] = now.isoformat()
```

### 2. Read-Then-Write Pattern

The endpoint fetches the flag before updating it. This serves two purposes:
- Verify the flag exists (return 404 if not)
- Return the full updated flag in the response (merge old fields with new)

This creates a small race window between the read and the write. For moderation workflows, this is generally acceptable — two moderators acting on the same flag simultaneously would result in the last write winning, which is a known trade-off.

### 3. No Downstream Side Effects Here

This endpoint only updates the `flags` table. Downstream effects (like actually removing flagged content) are expected to be triggered separately — either by a background job that processes approved flags, or by additional API calls from the moderator interface. Keeping this endpoint focused on flag state prevents partial-failure complexity.

### 4. Moderator Notes are Overwritten

If a moderator updates a flag multiple times (e.g., from `open` to `under_review`, then to `approved`), each update overwrites `moderatorNotes`. There is no history of intermediate notes. For a full audit trail, a separate `flag_actions` log table would be needed.

## Developer Tips

### Common Pitfalls

1. **Not setting updatedAt**: Always update `updatedAt` on every write. It is the timestamp consumers use to sort and detect changes.

2. **Forgetting resolvedAt logic**: `resolvedAt` should only be set for terminal states. Setting it prematurely (e.g., on `under_review`) creates confusing data.

3. **Trusting client-supplied moderatorId**: Always extract `moderatorId` from the verified JWT, not from the request body. Never allow a moderator to attribute an action to a different user.

4. **Race conditions on concurrent updates**: Two moderators could simultaneously claim `under_review` on the same flag. For production, consider a lightweight transaction (LWT) with `IF status = 'open'` to ensure only one claim succeeds.

### Query Performance Expectations

| Operation | Performance | Why |
|-----------|-------------|-----|
| Fetch flag by ID | < 5ms | Partition key lookup |
| Update flag | < 5ms | Partition key write |
| Total action flow | < 15ms | Two partition key operations |

## Related Endpoints

- [GET /api/v1/moderation/flags](/services/moderation/get-flags/) - View the queue to find flags to act on
- [GET /api/v1/moderation/flags/{flag_id}](/services/moderation/get-flag-details/) - Review flag details before acting
- [POST /api/v1/flags](/services/moderation/post-flag/) - How flags are originally created
