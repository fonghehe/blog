---
title: "Investigating Flutter Jank: Find the Expensive Frame"
date: 2026-09-09 09:53:14
tags:
  - Mobile
description: "Use profile mode and frame timelines to separate build, layout, paint, and raster costs."
readingTime: 2
wordCount: 449
---

A screen that feels uneven does not call for adding `const` to every widget. The expensive work may run in Dart build/layout, image decoding, or rasterization. Each path needs a different remedy.

## Measure a reproducible interaction

On a real device in profile mode, fix the screen, data set, and gesture. Record when slow frames occur, compare UI and raster times in the frame timeline, and relate each spike to the user's action. Hot reload, breakpoints, and first-run rendering can distort a sample; one isolated spike is not a diagnosis.

When UI time dominates, look for JSON parsing or sorting in `build`, and for broad state changes that rebuild an entire list. Move computations into the data layer, narrow subscriptions, and create long lists lazily with `ListView.builder`. When raster time dominates, inspect oversized images, blur, clipping, and repeated offscreen painting.

## Compare before and after

Change one factor at a time. On the same device and gesture, record slow-frame count, peak duration, and memory. A change that improves average frames but reloads images on every scroll is not a success. Repeat the path with larger system fonts and a lower-end device.

## Find the exact frame and the busy side

If expanding an image carousel on a product detail screen drops frames, do not rewrite widgets by intuition. Capture the same action in profile mode on the target device and inspect DevTools' frame chart and timeline. The frame budget depends on refresh rate: about 16.7 ms at 60 Hz and 8.3 ms at 120 Hz. An over-budget UI thread suggests build/layout work or Dart computation; an over-budget raster thread points more toward complex layers, clipping, blur, or image work. Record tail frame times, not just average FPS.

When UI work dominates, trace which state change rebuilds the whole page and narrow frequent price updates to a local listener. When raster work dominates, check that large images are decoded near their target dimensions and whether transparent layers and shadows pile up. Use `RepaintBoundary` only when isolating repeated paint work actually helps; it can also consume memory. An isolate may help with heavy image processing or JSON parsing, but include message-transfer cost in the decision rather than moving every tiny task off the main isolate.

```text
Reproduce → profile capture → over-budget frame → UI or raster?
          → one causal hypothesis → one change → same-device retest
          → check memory and visual output
```

## Define regression conditions for the fix

Measure first display, scrolling, and animation completion separately. After the change, inspect tail frame time, time to interaction, image sharpness, peak memory, and accessibility focus. A lower-end Android phone and a high-refresh-rate iPhone can expose different bottlenecks; at minimum compare before and after on the device that reproduced the issue. If results vary widely, fix network responses and input data, repeat several runs, and only then claim improvement.

See [Flutter UI performance guidance](https://docs.flutter.dev/perf/ui-performance).
