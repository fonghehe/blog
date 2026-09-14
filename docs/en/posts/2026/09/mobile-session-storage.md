---
title: "Mobile Sessions: Tokens, Logout, and Multi-Account Cache Isolation"
date: 2026-09-14 13:06:49
tags:
  - Mobile
description: "Define secure token storage, serialized refresh, logout cleanup, and account-scoped caches."
readingTime: 2
wordCount: 429
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

## Treat a session as state that can be revoked

On launch, the presence of a token in secure storage is not enough to show an authenticated screen. Read credentials, establish the local account identity, then validate or refresh the session with the server; during that work the app is explicitly `restoring`. Keep access tokens short-lived and refresh credentials in platform-protected storage. Preferences, logs, and crash reports should not contain secrets. If offline browsing is supported, define in advance which cached data may appear before session validation and when sensitive content must be hidden.

Concurrent 401 responses are a common trap: five failed requests should not each refresh and overwrite one another. Keep one refresh task per account and let the others await its result. If refresh fails or the server revokes the session, clear credentials, account-scoped cache, and pending sensitive operations as one state transition before navigating to sign-in. If A signs out and B signs in immediately, A's late API responses and refresh result must be rejected by a session-generation check.

```text
restoring → authenticated → refreshing → authenticated
                        ↘ refresh rejected → signedOut
signedOut → signingIn → authenticated(new account generation)
```

## Define sign-out and offline boundaries

On an explicit sign-out, block new authenticated requests and clear sensitive local state immediately. If the device is offline, remote revocation may need a later retry, but the UI must already behave as signed out. The server must authorize every high-risk request; hiding a client-side button is insufficient. Acceptance cases include process death, device-clock skew, simultaneous 401s, offline sign-out, rapid A/B switching, and refresh-token rotation. Record session transitions and failure classes, never the token value.
