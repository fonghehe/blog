---
title: "Mobile Deep Links: Safe Routing After Login"
date: 2026-09-11 15:29:08
tags:
  - Mobile
description: "Treat React Native and Flutter deep links as untrusted input, including cold starts and authentication redirects."
readingTime: 1
wordCount: 186
---

A deep link exposes an app route to browsers, messages, and other apps. It can open an order, but it can also carry an unknown path, expired ID, repeated navigation event, or a credential that should never have been placed in a URL.

## Parse before navigating

Accept only registered schemes and hosts, match paths against an allowlist, and validate parameter format and length. Do not turn any external URL directly into a navigation action. A token in a URL is not proof of login. An order ID is only a locator: fetch the order under the current session and let the server authorize access.

Both cold start and foreground delivery can present the same link. Deduplicate it, wait until the session is initialized, and consume a pending destination exactly once after login. Clear pending destinations on logout so the next account cannot inherit the previous user's link.

## Test from outside the app

Exercise signed-out, signing-in, signed-in, and account-switch states. Include deleted orders, malformed encoding, and repeated taps. Internal simulator navigation proves little about platform link registration or the external-input boundary.

See the [React Native security guide](https://reactnative.dev/docs/security).
