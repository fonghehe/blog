---
title: "A Mobile Screen State Contract for Loading, Offline, and Stale Data"
date: 2026-09-04 11:37:26
tags:
  - Mobile
description: "Model snapshots and request status separately so React Native and Flutter screens keep trustworthy data visible."
readingTime: 1
wordCount: 236
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
