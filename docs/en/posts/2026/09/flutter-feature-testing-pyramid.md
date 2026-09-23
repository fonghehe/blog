---
title: "Flutter Feature Tests: Repository, Widget, and Device Responsibilities"
date: 2026-09-23 12:18:06
tags:
  - Mobile
description: "Divide order-flow verification among unit, widget, and integration tests so failures remain explainable."
readingTime: 1
wordCount: 177
---

Putting every check in an end-to-end suite makes failures slow to locate. Testing only a ViewModel misses disabled buttons, hidden errors, and inaccessible controls. Choose the test layer according to the boundary that can fail.

## Give each layer a job

Repository unit tests cover cache fallback, error mapping, offline queues, and version conflicts with a fake clock and controlled network. Widget tests assert that old orders remain visible during refresh, empty states offer creation, and permission errors disable actions. Inject a fake repository rather than a live server. Keep only a few integration paths: login, order creation, offline recovery, and synchronization.

## Make failures deterministic

Use fixed IDs and timestamps so ordering bugs are visible. Wait for a defined state instead of sleeping a fixed number of seconds. Screenshot tests can protect stable key layouts, but pixel equality is not a substitute for behavior assertions. Fonts, scaling, and platform rendering can all change pixels.

Run a small device matrix for navigation, platform permissions, and persistence; keep exhaustive state transitions in fast lower-level tests. See the [Flutter testing overview](https://docs.flutter.dev/testing/overview).
