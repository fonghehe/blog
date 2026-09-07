---
title: "Diagnosing React Native List Jank Before Tuning FlatList"
date: 2026-09-07 19:14:42
tags:
  - Mobile
description: "Profile release-like builds and identify JS, layout, or image bottlenecks before changing FlatList settings."
readingTime: 1
wordCount: 195
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
