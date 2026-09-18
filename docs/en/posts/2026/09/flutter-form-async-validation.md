---
title: "Flutter Async Form Validation Without Stale Results"
date: 2026-09-18 10:25:57
tags:
  - Mobile
description: "Use debouncing, request generations, and server-side final checks to keep form errors tied to the current input."
readingTime: 2
wordCount: 427
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

## An edited field invalidates an old result

Take username availability in a registration form. The user enters `alice`; while request A is pending, they change it to `alice2` and start request B. Even if A later says “taken”, that error must not appear under `alice2`. Store the field value and sequence number for each asynchronous validation. Before updating the UI, compare the response with both the current value and latest sequence. Cancelling HTTP may save bandwidth, but this guard remains necessary because cancellation can race with a response.

Run local synchronous rules—required, length, format—on the immediate input path. Debounce checks that require server knowledge, such as username availability or coupon validity. Dispose timers and listeners when leaving the screen. At submission, do not trust a “available” hint from several seconds ago: the server must still enforce uniqueness atomically. Map returned validation errors to fields while keeping entered values; a network failure is a form-level problem, not proof that a field is invalid.

```dart
final valueAtStart = controller.text;
final ticket = ++latestValidation;
final available = await api.isUsernameAvailable(valueAtStart);
if (!mounted || ticket != latestValidation || controller.text != valueAtStart) return;
setState(() => usernameError = available ? null : 'Name is taken');
```

## Verify the whole form lifecycle

Test rapid typing, deleting and re-entering the same value, reversed slow responses, device rotation, a response after leaving the screen, disconnection during submit, and repeated taps. In particular, successful submission should navigate once; after failure the button must be usable again. If the page uses a state manager instead of `StatefulWidget`, replace `mounted` with its lifecycle guard. The essential rule remains that a result belongs to the current field value and current request.
