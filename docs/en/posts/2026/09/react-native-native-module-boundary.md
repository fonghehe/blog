---
title: "React Native Native Capability Boundaries and Failure Semantics"
date: 2026-09-21 17:46:21
tags:
  - Mobile
description: "Design native scanning and biometrics APIs around permissions, cancellation, and lifecycle cleanup."
readingTime: 2
wordCount: 461
---

Exposing a scanner or biometric method to JavaScript is only the start. Permission dialogs, backgrounding, unsupported hardware, and user cancellation all affect the business flow. Returning one vague rejected Promise leaves the screen unable to respond correctly.

## Give every outcome a meaning

Distinguish `success`, `cancelled`, `permissionDenied`, `unavailable`, and `failed`. Cancellation is not a crash; denied permission is not a bad scan. The native module should return raw scan data, while the business layer fetches the order, checks access, and renders the result. This avoids coupling platform code to a backend domain model.

Allow only one active scan. Leaving the screen or backgrounding the app should close the native session and release the camera. Repeated taps should join the active call or report that it is already running. Remove event listeners on unmount so revisiting the screen does not double-handle a result.

## Verify the native contract on hardware

Simulators can test JavaScript branches, but not all camera and system permission behavior. Test first authorization, permanent denial, permission revocation in Settings, backgrounding during scanning, and repeated taps on iOS and Android. A JS-only update cannot change native code already inside an installed binary.

## Define the boundary with a scanner

A business screen needs “scan a QR code and return its text”; it should not understand Android permission callbacks, iOS camera interruptions, or a native library's internal events. Keep the JS-facing contract small: `scan(options): Promise<ScanResult>`, with normalized text and source in the result, and stable error codes for cancellation, denied permission, and unavailable hardware. The business flow chooses when to ask for permission, while the platform owns the actual permission and device state. Do not pass raw native exception strings to the UI; they change across OS versions.

One scan may outlive its screen, an app backgrounding, or destruction of the React Native instance. The native side must settle or cancel each call exactly once, close the camera, remove listeners, and reject a second concurrent scan or explicitly queue it. The JS side must associate the result with the current screen instance; a late promise from an old screen cannot navigate the new one. For large image data, a controlled file handle or path is often better than repeatedly passing base64 across the JS boundary, with an explicit owner for temporary-file cleanup.

```ts
type ScanResult = { text: string; source: 'camera' | 'image' };
type ScanErrorCode = 'CANCELLED' | 'PERMISSION_DENIED' | 'UNAVAILABLE';
interface Scanner { scan(options: { formats: string[] }): Promise<ScanResult> }
```

## Test the contract across platforms

In JS tests, simulate success, cancellation, denial, leaving the screen, and repeated taps. In native integration tests, check resource release, background transitions, and a permission revoked in system settings. Run a real scan on both iOS and Android and compare the normalized result for the same code. Migrating to a new architecture or native library should not force a business-screen rewrite if the contract stays stable. See [React Native native-module lifecycle](https://reactnative.dev/docs/the-new-architecture/native-modules-lifecycle).

See [React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction).
