---
title: "Diagnosing React Native List Jank Before Tuning FlatList"
date: 2026-09-07 19:14:42
tags:
  - Mobile
description: "Profile release-like builds and identify JS, layout, or image bottlenecks before changing FlatList settings."
readingTime: 2
wordCount: 447
---

A slow list is not necessarily caused by a small FlatList window. Expensive row calculations, image decoding, and updates to the entire screen can all look like dropped frames. Reproduce the issue in a release-like build before choosing a fix.

## Identify the busy thread

Record the device, item count, image dimensions, and exact gesture. Compare JS and UI thread frame rates. If JS is busy formatting data or rerendering rows, reduce row dependencies and move work out of render. If the UI thread is busy during scrolling, inspect image size, layout, and native views. Debug-mode performance is not a reliable release benchmark.

## Tune only a confirmed bottleneck

Fixed-height rows can use `getItemLayout` to avoid measuring scroll targets. Use stable business IDs, not array indexes, as keys. Deduplicate pagination requests and discard responses from a previous filter. Window and batch sizes should be measured on a low-end device for both memory use and blank areas, rather than increased blindly.

```tsx
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
  onEndReached={loadNextPage}
/>
```

`getItemLayout` is wrong when row height changes with localization, images, or large system text. Acceptance testing should include fast scrolling, uncached images, filtering, and enlarged fonts—not just a small empty demo.

See the [React Native performance guide](https://reactnative.dev/docs/performance).

## Start with one reproducible hitch

Suppose a product list visibly stutters near row 80. Reproduce it in a release build on the same device and data set, recording scroll direction, row count, image dimensions, and the interval of dropped frames. Development mode adds overhead that can distort the diagnosis. Then inspect JS and UI work separately: price formatting or broad state updates can block touch feedback on the JS thread, while image decoding or expensive drawing can stall the UI thread even when JS is idle. Do not begin by changing `windowSize`; that may trade a hitch for blank cells.

Fixed-height rows can use `getItemLayout`, but a row with wrapping titles, large fonts, or expanded content must not pretend to have fixed height—`scrollToIndex` would land incorrectly. Load images near their display size and cache them. Give rows only the stable fields they render. A changing `renderItem` closure or a parent that forwards every global-store update to the entire list can still cause mass rerenders despite `memo`.

```tsx
const Row = memo(function Row({ item, onOpen }: RowProps) {
  return <Pressable onPress={() => onOpen(item.id)}><Text>{item.title}</Text></Pressable>;
});
// Also check data, keyExtractor, and onOpen stability; memo alone is insufficient.
```

## Validate one hypothesis at a time

Record baseline frame time, time to first screen, peak memory, and blank-cell count. If the render window looks too large, change one virtualization parameter and replay the same scroll path. If state fan-out looks suspicious, count row renders, toggle a single favourite, and check that only affected rows update. Repeat on a lower-end device with fast scrolling, restored scroll position, enlarged text, and image failures. Better frame numbers with blank cells or lost accessibility focus are not a finished improvement.
