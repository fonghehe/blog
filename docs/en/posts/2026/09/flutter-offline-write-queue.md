---
title: "Flutter Offline Write Queues: Drafts, Retries, and Conflicts"
date: 2026-09-02 16:08:53
tags:
  - Mobile
description: "Design a local write queue with idempotency keys, explicit conflict states, and safe recovery."
readingTime: 3
wordCount: 501
---

Offline-first does not mean retrying every failed request forever. A work-order draft edited on a train must survive an app restart; restoring connectivity must not create two orders; and edits made on another device need an understandable conflict state.

## Make the local record the visible source

Read the UI from a local database. In one transaction, update the visible draft and append a pending operation containing an operation ID, entity ID, base version, payload, creation time, and status. Send the operation ID as an idempotency key so retrying after a timeout does not duplicate a write.

Process operations serially per entity. A network failure warrants backoff; an expired session pauses the queue; a permanent server rejection keeps the draft and explains what the user can do. One malformed operation must not block every unrelated work order.

```text
Edit → local transaction saves draft + pending operation → UI shows "Pending sync"
Online → submit serially per entity → server confirms version → mark synced
Version conflict → mark conflict → offer diff and resubmit actions
```

## Resolve conflicts by field

Append-only notes may be merged, but money and approval decisions usually need server arbitration. Do not blindly apply last-write-wins. After confirmation, replace the local snapshot with the server's final entity and remove the acknowledged operation. Background execution is limited on mobile platforms, so foreground resume and explicit sync should also advance the queue.

Test process termination, duplicate acknowledgments, simultaneous edits on two devices, and expired permissions. Merely displaying a draft while offline does not prove synchronization is safe.

## Follow one work order from edit to acknowledgement

Define a local transaction first. When the user saves, write the work-order draft and a `pending_operation` together. The operation needs a stable `operationId`, target ID, `baseVersion`, serialized change, creation time, and status. The draft becomes visible immediately with a “Pending sync” label. Sending HTTP before persisting the draft leaves a gap if the process dies after the server accepts the request.

Suppose a train enters a tunnel: the server creates the order, but its response never reaches the phone. Retry with the **same** idempotency key. The server must also retain the key and result for an agreed window; a client-generated UUID alone provides no deduplication. On acknowledgement, update the server version, canonical snapshot, and operation state in one local transaction. If the app crashes after receiving the response but before committing it, the next attempt uses the original key and receives the same result.

```text
local draft + operation(id=K, base=7)
  → POST /work-orders  Idempotency-Key: K
  → timeout: keep pending, retry K
  → 200(version=8): atomically replace snapshot and acknowledge K
  → 409(current=9): stop this entity's queue and surface a conflict
```

## Route failures instead of merely increasing backoff

Timeouts and 5xx responses may retry with backoff. A 401 pauses the queue for authentication; a 403 or validation failure becomes an actionable terminal state; a 409 preserves the local change and displays a field-level difference. Different entities may progress independently, while operations on one entity must keep causal order so “rename” cannot arrive before “create”. Before cancelling an unsent operation, check whether later operations depend on it.

For acceptance, kill the process before sending, after server processing but before the response, and after the response but before the local commit. Then produce a two-device version conflict. Inspect the list, pending badge, server entity count, and operation table each time. A visible draft alone does not prove safe synchronization.

See [Flutter's offline-first architecture guide](https://docs.flutter.dev/app-architecture/design-patterns/offline-first).
