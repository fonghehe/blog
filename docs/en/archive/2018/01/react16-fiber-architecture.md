---
title: "React 16 Fiber Architecture: Why They Rewrote the Rendering Engine"
date: 2018-01-25 11:10:29
tags:
  - React
readingTime: 2
description: "React 16 shipped a complete rewrite of the rendering engine called **Fiber**. The public API is mostly unchanged, but the internal scheduling model is fundament"
wordCount: 347
---

React 16 shipped a complete rewrite of the rendering engine called **Fiber**. The public API is mostly unchanged, but the internal scheduling model is fundamentally different.

## The Problem with React 15

React 15's reconciler was synchronous and uninterruptible. Once it started reconciling, it had to finish the entire tree before yielding back to the browser.

On a complex component tree (thousands of nodes), reconciliation could take 50-100ms. During that time:

- The browser couldn't respond to user events
- Animations stuttered
- Input felt laggy

This is known as "jank" — the main thread was monopolized.

## Fiber's Solution

Fiber breaks reconciliation into small units of work (Fiber nodes) that can be **paused and resumed**:

```
React 15: [=================== reconcile 100ms ===================] → commit → render
Browser:   [blocked during reconcile, cannot respond to user input]

React 16 Fiber:
  [reconcile 5ms] → [yield to browser] → [reconcile 5ms] → ... → commit → render
Browser:  can handle input/animations during yield gaps
```

## Two Phases

Fiber separates work into two phases:

**Phase 1: Reconciliation (async, interruptible)**

- Build the "work in progress" fiber tree
- Diff old and new trees
- Collect changes (this is what can be paused/interrupted)

**Phase 2: Commit (sync, uninterruptible)**

- Apply all DOM mutations at once
- Run layout effects, ref updates
- Must be synchronous so the user never sees a partial state

Because Phase 1 can be interrupted, **lifecycle methods called during Phase 1 may run multiple times**. This is why `componentWillMount`, `componentWillReceiveProps`, and `componentWillUpdate` are deprecated — they're called in Phase 1 and were being misused with side effects.

## Fiber Node Structure

The fiber tree uses a singly-linked list structure:

```javascript
// Simplified Fiber node
{
  type: 'div',          // component type
  stateNode: domNode,   // actual DOM node
  child: fiberNode,     // first child
  sibling: fiberNode,   // next sibling
  return: fiberNode,    // parent
  effectTag: 'UPDATE',  // what needs to happen (UPDATE/INSERT/DELETE)
  alternate: fiberNode, // pointer to the corresponding fiber in the other tree
}
```

The linked list structure allows traversal to be interrupted and resumed — you just save a pointer to where you stopped.

## Priority Scheduling

Fiber introduces a priority system for updates:

- Synchronous: must happen now (user input)
- Task: current event loop
- Animation: next frame
- High: soon
- Low: can be delayed
- Offscreen: do when nothing else is pending

High-priority updates (like typing) can interrupt low-priority updates (like a large data re-render) and be applied first.

## What Fiber Enables

React 16 shipped these features as a result of the Fiber rewrite:

- **Error Boundaries** — componentDidCatch
- **Fragments** — return arrays from render
- **Portals** — render outside parent DOM node
- **createPortal**
- **Improved SSR performance**

The bigger features (Concurrent Mode, Suspense) were reserved for future releases but only became possible because of Fiber.
