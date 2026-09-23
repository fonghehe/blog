---
title: "Flutter Feature Tests: Repository, Widget, and Device Responsibilities"
date: 2026-09-23 12:18:06
tags:
  - Mobile
description: "Divide order-flow verification among unit, widget, and integration tests so failures remain explainable."
readingTime: 2
wordCount: 453
---

Putting every check in an end-to-end suite makes failures slow to locate. Testing only a ViewModel misses disabled buttons, hidden errors, and inaccessible controls. Choose the test layer according to the boundary that can fail.

## Give each layer a job

Repository unit tests cover cache fallback, error mapping, offline queues, and version conflicts with a fake clock and controlled network. Widget tests assert that old orders remain visible during refresh, empty states offer creation, and permission errors disable actions. Inject a fake repository rather than a live server. Keep only a few integration paths: login, order creation, offline recovery, and synchronization.

## Make failures deterministic

Use fixed IDs and timestamps so ordering bugs are visible. Wait for a defined state instead of sleeping a fixed number of seconds. Screenshot tests can protect stable key layouts, but pixel equality is not a substitute for behavior assertions. Fonts, scaling, and platform rendering can all change pixels.

Run a small device matrix for navigation, platform permissions, and persistence; keep exhaustive state transitions in fast lower-level tests. See the [Flutter testing overview](https://docs.flutter.dev/testing/overview).

## Build a test mix around one transfer

A transfer includes amount validation, recipient lookup, a confirmation screen, submission, and a result screen. Keep amount limits, currency precision, balances, and fee calculations in pure logic outside widgets, with unit tests for boundary and rounding cases; these are cheap enough to run on every change. Then use widget tests for input errors, loading, confirmation, and recovery, injecting a fake repository and controllable clock. Do not merely assert that copy appears: check that submit is disabled during a request, re-enabled after failure, and protected from an old response contaminating a new form.

Reserve integration tests for a few critical journeys: sign in, open transfer, confirm the recipient, submit, and find the record. Use a controlled test backend or clearly identified simulator with isolated accounts and data; a real-money network does not belong in CI. System keyboards, permission prompts, deep-link return, and background transitions still need a pass in the actual target runtime. Widget tests cannot substitute for those OS interactions.

| Layer | Main question | Example assertion |
| --- | --- | --- |
| Unit | Are rules correct? | Currency precision, fees, amount boundaries |
| Widget | Can UI state recover? | No duplicate submit; retry after failure |
| Integration | Do parts cooperate? | One submission yields one server record |
| Device acceptance | Does OS behavior fit? | Keyboard, resume, weak network |

## Keep test doubles from hiding races

A fake repository should let tests resolve requests in a chosen order rather than always succeeding immediately. Cover competing submissions, a response after leaving the page, server timeout after actual success, and duplicate navigation to a result page. The server's idempotent outcome determines whether a request succeeded; a test's assumed navigation count does not. See [Flutter testing overview](https://docs.flutter.dev/testing/overview).
