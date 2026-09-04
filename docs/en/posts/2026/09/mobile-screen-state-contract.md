---
title: "A Mobile Screen State Contract for Loading, Offline, and Stale Data"
date: 2026-09-04 11:37:26
tags:
  - Mobile
description: "Model snapshots and request status separately so React Native and Flutter screens keep trustworthy data visible."
readingTime: 3
wordCount: 508
---

One `isLoading` boolean cannot describe a real mobile screen. A refresh may run while old data remains useful; a successful response may truly be empty; and offline with a cache is very different from offline without one.

## Separate the snapshot from the request

Keep `snapshot`, `lastSyncedAt`, `requestState`, and `error`. Derive presentation from these fields instead of packing every combination into one large enum. With no snapshot, show a loading skeleton or a retryable error. With a snapshot, retain the content during refresh and show a non-blocking error if refresh fails. Show a true empty state only after a trusted successful response.

| Snapshot | Request | Screen behavior |
| --- | --- | --- |
| None | Initial load | Skeleton and a way back |
| None | Failed | Error and retry action |
| Present | Refreshing | Keep content with a subtle progress indicator |
| Present | Failed | Keep content, show sync time and non-blocking error |
| Empty list | Succeeded | True empty state and create action |

## Put the rules outside the view

Implement a pure `deriveScreenState(snapshot, request)` selector in React Native or a ViewModel in Flutter. Initial load, pull-to-refresh, foreground resume, and notification-triggered refresh should use the same data entry point; they differ in cause, not in the definition of a trusted snapshot.

Test slow networks, repeated refreshes, account switching, and offline startup. A failed request must not clear an existing list or turn it into an empty state. After an account change, the previous user's snapshot must disappear before the new screen is shown.

## Give the empty state evidence

Consider an inbox. With no cache on first entry, the screen is `initialLoading`; it becomes `confirmedEmpty` only after a successful response containing zero messages. If twenty messages were previously confirmed, pull-to-refresh should leave them readable in `refreshingWithData`. A failed refresh becomes `staleWithError`, retaining those twenty messages and the last successful sync time. Collapsing these cases into `loading | success | error` forces the UI either to clear useful content during refresh or to mistake a failure for an empty inbox.

Store facts such as `{accountId, items, lastSuccessAt, revision, pending}` in the repository and derive presentation state from them. Avoid independently maintained boolean flags in each component. `items=[]` only says that an array is empty; a successful response for the *current account* is the evidence needed for a real empty state. On an account change, isolate the old snapshot before loading the new account's cache so old messages never flash on the new screen.

| Event | Data retained | Screen feedback |
| --- | --- | --- |
| First load fails | None | Error view and retry |
| Refresh fails with cache | Last confirmed list | Inline error, sync time, retry |
| Successful empty response | Current account's empty snapshot | Explicit empty-state copy |
| Account changes | New account cache only | Skeleton or new account snapshot |

## Test transitions rather than screenshots alone

A reducer or state-machine test can assert that `success(20) → refresh → timeout` retains twenty rows; `success(20) → success(0)` may show the empty state; and `load A → switch to B → A responds` discards A's result. A UI test then checks the retry action, screen-reader announcement, and stale-data label. These tests describe what the user experiences over time, not merely one static frame.
