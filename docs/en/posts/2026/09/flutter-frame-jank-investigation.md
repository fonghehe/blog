---
title: "Investigating Flutter Jank: Find the Expensive Frame"
date: 2026-09-09 09:53:14
tags:
  - Mobile
description: "Use profile mode and frame timelines to separate build, layout, paint, and raster costs."
readingTime: 1
wordCount: 194
---

A screen that feels uneven does not call for adding `const` to every widget. The expensive work may run in Dart build/layout, image decoding, or rasterization. Each path needs a different remedy.

## Measure a reproducible interaction

On a real device in profile mode, fix the screen, data set, and gesture. Record when slow frames occur, compare UI and raster times in the frame timeline, and relate each spike to the user's action. Hot reload, breakpoints, and first-run rendering can distort a sample; one isolated spike is not a diagnosis.

When UI time dominates, look for JSON parsing or sorting in `build`, and for broad state changes that rebuild an entire list. Move computations into the data layer, narrow subscriptions, and create long lists lazily with `ListView.builder`. When raster time dominates, inspect oversized images, blur, clipping, and repeated offscreen painting.

## Compare before and after

Change one factor at a time. On the same device and gesture, record slow-frame count, peak duration, and memory. A change that improves average frames but reloads images on every scroll is not a success. Repeat the path with larger system fonts and a lower-end device.

See [Flutter UI performance guidance](https://docs.flutter.dev/perf/ui-performance).
