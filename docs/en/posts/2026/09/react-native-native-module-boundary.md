---
title: "React Native Native Capability Boundaries and Failure Semantics"
date: 2026-09-21 17:46:21
tags:
  - Mobile
description: "Design native scanning and biometrics APIs around permissions, cancellation, and lifecycle cleanup."
readingTime: 1
wordCount: 197
---

Exposing a scanner or biometric method to JavaScript is only the start. Permission dialogs, backgrounding, unsupported hardware, and user cancellation all affect the business flow. Returning one vague rejected Promise leaves the screen unable to respond correctly.

## Give every outcome a meaning

Distinguish `success`, `cancelled`, `permissionDenied`, `unavailable`, and `failed`. Cancellation is not a crash; denied permission is not a bad scan. The native module should return raw scan data, while the business layer fetches the order, checks access, and renders the result. This avoids coupling platform code to a backend domain model.

Allow only one active scan. Leaving the screen or backgrounding the app should close the native session and release the camera. Repeated taps should join the active call or report that it is already running. Remove event listeners on unmount so revisiting the screen does not double-handle a result.

## Verify the native contract on hardware

Simulators can test JavaScript branches, but not all camera and system permission behavior. Test first authorization, permanent denial, permission revocation in Settings, backgrounding during scanning, and repeated taps on iOS and Android. A JS-only update cannot change native code already inside an installed binary.

See [React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction).
