---
title: "Flutter Async Form Validation Without Stale Results"
date: 2026-09-18 10:25:57
tags:
  - Mobile
description: "Use debouncing, request generations, and server-side final checks to keep form errors tied to the current input."
readingTime: 1
wordCount: 187
---

Registration and payment forms often check usernames, coupons, or recipient accounts asynchronously. If the user enters A and quickly changes to B, A's late response can incorrectly mark B as unavailable. This is a result-ownership problem, not a styling issue.

## Bind validation to an input snapshot

Increment a generation counter on every input change and debounce the request. When it completes, apply the result only if both the generation and current text still match. A passing local regular expression is insufficient for submission; required asynchronous checks should finish, and the server must validate again when accepting the final request.

Cancel timers when the widget is disposed. Distinguish a network error from an actual “name unavailable” result so the user can retry instead of changing a valid name.

```dart
int generation = 0;

Future<void> validateName(String name) async {
  final current = ++generation;
  final result = await repository.checkName(name);
  if (!mounted || current != generation || controller.text != name) return;
  setState(() => nameError = result.isAvailable ? null : 'Name unavailable');
}
```

## Treat submission as a separate state machine

Lock repeated taps while submitting and include an idempotency key. Map field-level server errors back to the relevant inputs without erasing the rest of the form. On failure, keep edits and enable retry; on success, navigate once.

Test responses arriving out of order, leaving the page mid-request, rotation, and losing connectivity during submission.
