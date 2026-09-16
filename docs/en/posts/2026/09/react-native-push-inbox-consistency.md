---
title: "React Native Push Landing Screens and Inbox Consistency"
date: 2026-09-16 20:11:35
tags:
  - Mobile
description: "Deduplicate notifications and reconcile navigation with authoritative server-side message state."
readingTime: 2
wordCount: 437
---

A push notification signals that something happened; it is not an authoritative copy of the business record. A user might handle a work order on another device before tapping the notification. Showing actions based only on the push payload could then expose stale controls.

## Unify three delivery paths

Foreground receipt, tapping a background notification, and reading the initial notification at cold start should all produce `{ eventId, targetType, targetId }`. Deduplicate the event ID so platform callbacks cannot navigate twice. After restoring the session, fetch the target entity. The server owns unread counts; an optimistic local read can improve responsiveness, but it must roll back on failure.

The payload should contain only routing identifiers—not access tokens, complete private records, or final order status. A deleted, unauthorized, or already-completed target needs a specific landing state rather than one generic loading error.

## Test on devices

Check foreground, background, terminated, notification permission disabled, repeated taps, and a changed login account. For Expo projects, validate push in a development build rather than relying on Expo Go behavior.

See the [Expo push notification guidance](https://docs.expo.dev/push-notifications/what-you-need-to-know/).

## A push is a hint, not the message source of truth

Consider a support inbox. The server stores a message and sends a push; the phone might receive the push before syncing the message, receive it twice, or receive it after the user has already read the message elsewhere. Carry stable `messageId`, conversation ID, and a deduplication event ID in the notification payload. Let the server's message state determine detail content and badge count. Push arrival order is not message order, and one push must not permanently increment unread count by itself.

When a notification arrives in the foreground, put its event ID in a short-lived deduplication set and request an incremental sync for that conversation. When the user taps a notification in the background, restore the session and fetch the message before navigating. If it was withdrawn or the current account lacks access, show a safe unavailable state rather than cached private text. A foreground callback, notification-tap callback, and resume sync may all request the same data; coalesce them in the repository.

```text
Message stored(version=42) → event=E9 sent → device receives E9 twice
  → deduplicate and fetch once → merge by messageId → use server unread count
```

## Make badges and read receipts recoverable

Opening a conversation may optimistically mark it read locally, but a failed request should leave a pending state that can retry. After cross-device synchronization, move the local `readThrough` watermark to the server-confirmed version. Use the confirmed server unread total for the badge; offline, label it as potentially unsynced rather than pretending it is exact. Test duplicate and out-of-order pushes, revoked access, offline devices, cold-start taps, and account switches. Verify that notification content cannot leak a previous account's private message.
