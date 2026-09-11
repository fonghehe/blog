---
title: "Mobile Deep Links: Safe Routing After Login"
date: 2026-09-11 15:29:08
tags:
  - Mobile
description: "Treat React Native and Flutter deep links as untrusted input, including cold starts and authentication redirects."
readingTime: 2
wordCount: 426
---

A deep link exposes an app route to browsers, messages, and other apps. It can open an order, but it can also carry an unknown path, expired ID, repeated navigation event, or a credential that should never have been placed in a URL.

## Parse before navigating

Accept only registered schemes and hosts, match paths against an allowlist, and validate parameter format and length. Do not turn any external URL directly into a navigation action. A token in a URL is not proof of login. An order ID is only a locator: fetch the order under the current session and let the server authorize access.

Both cold start and foreground delivery can present the same link. Deduplicate it, wait until the session is initialized, and consume a pending destination exactly once after login. Clear pending destinations on logout so the next account cannot inherit the previous user's link.

## Test from outside the app

Exercise signed-out, signing-in, signed-in, and account-switch states. Include deleted orders, malformed encoding, and repeated taps. Internal simulator navigation proves little about platform link registration or the external-input boundary.

See the [React Native security guide](https://reactnative.dev/docs/security).

## Trust boundaries around an invitation link

A customer taps `https://example.com/invite?code=...` and the OS may hand it to the app. Arrival through an OS callback does not make the URL trustworthy. Parse only expected hosts and paths, and bound parameter length and encoding. Ask the server, under the *current* signed-in identity, whether the invitation exists, is unexpired, and may be accepted by this person. Never promote `role=admin`, a price, or a target account from the URL directly into authorized business state. If sign-in is needed, save only a minimal pending destination; after sign-in, fetch and authorize it again.

Separate “open details” from “perform action” for links with side effects. An invitation screen can show the organization and permissions returned by the server, but accepting still needs an explicit tap. Payment, transfer, and deletion must not execute while parsing a link. Use a fixed allowlist for external fallback destinations rather than following an arbitrary `redirect` parameter. Logs should not contain full tokens or invitation codes.

```text
OS callback → normalize URL → allowlisted host/path/parameters → session
            → server lookup and authorization → confirmation screen
            → explicit user submission
```

## Verify platform setup and hostile input

On iOS, Universal Links require an associated-domain file that matches the app entitlement; Android App Links require a verifiable domain association. Test cold start, an already-running process, signed-in and signed-out states because their navigation stacks differ. Feed duplicate parameters, oversized encodings, case variants, revoked invitations, cross-account links, and malicious fallback URLs. An unauthorized target must reveal no content and cause no server write. See [Apple Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) and [Android App Links](https://developer.android.com/training/app-links).
