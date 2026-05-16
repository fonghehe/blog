---
title: "Vue Virtual DOM and the Diff Algorithm"
date: 2018-12-01 10:43:17
tags:
  - Vue
readingTime: 1
description: "Interviewers frequently ask \"How does Vue's diff algorithm work?\" and most articles on the subject are frustratingly abstract. Here's an explanation with concre"
---

Interviewers frequently ask "How does Vue's diff algorithm work?" and most articles on the subject are frustratingly abstract. Here's an explanation with concrete examples.

## Why Virtual DOM?

Manipulating real DOM nodes is slow because every operation can trigger browser reflow (layout) and repaint.

```javascript
// The brute-force way to update a list:
container.innerHTML = items.map((item) => `<li>${item.name}</li>`).join("");
// Problem: destroys all DOM nodes and recreates them,
//          losing DOM state (focus, scroll position, etc.)

// The ideal way: update only what changed.
// Virtual DOM models the DOM as plain JS objects and computes
// the minimum diff between old and new virtual trees.
```

## Virtual DOM Structure

```javascript
// Real DOM
// <div class="container">
//   <ul>
//     <li>Item 1</li>
//   </ul>
// </div>

// Corresponding virtual DOM (simplified)
const vnode = {
  tag: "div",
  data: { class: "container" },
  children: [
    {
      tag: "ul",
      children: [{ tag: "li", children: [{ text: "Item 1" }] }],
    },
  ],
};
```

## Core Principles of the Diff Algorithm

Vue's diff algorithm makes a few key assumptions (borrowed from React's diff):

```
1. Only compare nodes at the same level (no cross-level comparisons)
   → A node moving from div A to div B is treated as delete + insert
   → Cross-level DOM moves are extremely rare in practice

2. Nodes of different types are replaced outright (no deep comparison)
   → <div> becoming <p> → replace the entire subtree

3. Same-type nodes use key to determine identity
   → No key: compare by position
   → With key: match nodes by key to enable reordering
```

## List Diff: Double-End Comparison

Vue 2's list diff uses a **double-end comparison**: it simultaneously compares from both ends of the old and new lists:

```javascript
// Old list: [A, B, C, D]
// New list: [D, A, B, C]

// Step 1: Compare old-start (A) and new-start (D) → no match
// Step 2: Compare old-end (D) and new-end (C) → no match
// Step 3: Compare old-start (A) and new-end (C) → no match
// Step 4: Compare old-end (D) and new-start (D) → MATCH!
//         Move D from the end to the front

// Result: move node D to the beginning — just one DOM move instead of four
```

## The Role of key

```vue
<!-- Without key: Vue re-uses nodes by position — input value is lost when list reorders -->
<li v-for="item in items">{{ item.name }}</li>

<!-- With key: Vue matches nodes by identity — state is preserved on reorder -->
<li v-for="item in items" :key="item.id">{{ item.name }}</li>
```

## Vue 3 Diff Improvements

Vue 3 introduces a **longest increasing subsequence** (LIS) algorithm to minimise DOM moves:

```javascript
// Old: [1, 2, 3, 4, 5]
// New: [1, 3, 2, 4, 5]

// Vue 2: reorders by double-end, may move more nodes
// Vue 3: finds LIS ([1, 2, 4, 5] or [1, 3, 4, 5]) — only moves nodes outside the LIS
//        → only move node 2 or 3 instead of multiple moves
```

## Summary

- Virtual DOM avoids unnecessary full re-renders by computing the minimum patch
- Same-level-only comparison keeps the algorithm O(n) instead of O(n³)
- The `key` attribute is critical for correct list reordering — always provide it
- Vue 3's LIS-based diff further reduces the number of DOM move operations
