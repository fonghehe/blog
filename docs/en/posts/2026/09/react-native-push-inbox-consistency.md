---
title: "React Native Push Landing Screens and Inbox Consistency"
date: 2026-09-16 20:11:35
tags:
  - Mobile
description: "Deduplicate notifications and reconcile navigation with authoritative server-side message state."
readingTime: 1
wordCount: 179
---

A push notification signals that something happened; it is not an authoritative copy of the business record. A user might handle a work order on another device before tapping the notification. Showing actions based only on the push payload could then expose stale controls.

## Unify three delivery paths

Foreground receipt, tapping a background notification, and reading the initial notification at cold start should all produce `{ eventId, targetType, targetId }`. Deduplicate the event ID so platform callbacks cannot navigate twice. After restoring the session, fetch the target entity. The server owns unread counts; an optimistic local read can improve responsiveness, but it must roll back on failure.

The payload should contain only routing identifiers—not access tokens, complete private records, or final order status. A deleted, unauthorized, or already-completed target needs a specific landing state rather than one generic loading error.

## Test on devices

Check foreground, background, terminated, notification permission disabled, repeated taps, and a changed login account. For Expo projects, validate push in a development build rather than relying on Expo Go behavior.

See the [Expo push notification guidance](https://docs.expo.dev/push-notifications/what-you-need-to-know/).
