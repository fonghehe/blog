---
title: "Mobile Sessions: Tokens, Logout, and Multi-Account Cache Isolation"
date: 2026-09-14 13:06:49
tags:
  - Mobile
description: "Define secure token storage, serialized refresh, logout cleanup, and account-scoped caches."
readingTime: 1
wordCount: 177
---

Session bugs often appear only after reopening a mobile app: the previous account flashes on screen, simultaneous requests refresh the token multiple times, or a late callback writes credentials back after logout. Credential and business-data lifecycles must be designed together.

## Set storage and cache boundaries

Keep sensitive tokens in platform secure storage. Partition ordinary business caches by user ID, not merely by request path. Never place tokens in logs, deep links, or plaintext files available to other apps. On startup, restore and validate the session before showing private cached data.

## Allow one refresh in flight

When a token expires, requests share one refresh Promise or Future. A rejected refresh invalidates the session centrally and cancels pending requests; each screen must not open its own login prompt. Increment a session epoch on logout or account switch. Responses tagged with the previous epoch must not update the new account, even if they arrive later.

```text
session A, epoch 7 → request starts
logout or switch accounts → epoch 8; clear A's private cache
old request returns → epoch mismatch; discard response
```

Test process restart, clock skew, concurrent 401 responses, offline logout, and rapid account changes. Client isolation complements rather than replaces server authorization on every request.
