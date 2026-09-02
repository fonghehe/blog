---
title: "Flutter Offline Write Queues: Drafts, Retries, and Conflicts"
date: 2026-09-02 16:08:53
tags:
  - Mobile
description: "Design a local write queue with idempotency keys, explicit conflict states, and safe recovery."
readingTime: 1
wordCount: 223
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

See [Flutter's offline-first architecture guide](https://docs.flutter.dev/app-architecture/design-patterns/offline-first).
