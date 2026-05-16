---
title: "React 20 Concurrent Features Mature"
date: 2025-01-20 10:00:00
tags:
  - React
readingTime: 3
description: "React 20's concurrent features are no longer experimental. `useTransition`, `useDeferredValue`, and the new Scheduling API have all reached stable status, with "
---

React 20's concurrent features are no longer experimental. `useTransition`, `useDeferredValue`, and the new Scheduling API have all reached stable status, with significant performance optimizations at the underlying level. For complex applications that need to handle large volumes of user interactions, these features can finally be used with confidence.

## useTransition in Practice

The most common use of `useTransition` is preventing route transitions or large data filtering from blocking input. React 20 has optimized the scheduling granularity of transitions so that low-priority updates are no longer starved for long periods by high-priority ones.

```javascript
import { useState, useTransition, Suspense } from "react";

function SearchableProductList({ products }) {
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleFilter = (e) => {
    // Immediately update the input (high priority)
    setFilter(e.target.value);

    // Put filtering computation in a transition (low priority)
    startTransition(() => {
      setFilteredProducts(
        products.filter((p) =>
          p.name.toLowerCase().includes(e.target.value.toLowerCase()),
        ),
      );
    });
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <input
        type="text"
        value={filter}
        onChange={handleFilter}
        placeholder="搜索产品..."
      />
      <div
        style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 150ms" }}
      >
        <ProductGrid products={filtered} />
      </div>
      {isPending && <Spinner position="top-right" />}
    </div>
  );
}
```

The React 20 improvement: state updates inside a transition can be interrupted and resumed. When you type rapidly in quick succession, React discards intermediate stale computations and only executes the last one.

## useDeferredValue with Auto-Memoization

`useDeferredValue` in React 20 gains compiler optimization support. It no longer simply delays value propagation but instead cooperates with the React Compiler to only re-render the subtrees that actually need to update.

```javascript
import { useState, useDeferredValue, memo } from "react";

// React 20 Compiler will automatically optimize this component
// No need to write memo manually
function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function App() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // When query changes, the input updates immediately
  // filteredProducts uses deferredQuery, so the update is deferred
  const filteredProducts = useMemo(
    () => filterProducts(deferredQuery),
    [deferredQuery],
  );

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

A key change: `useDeferredValue` now supports a custom comparison function:

```javascript
// New in React 20: custom comparison logic
const deferredQuery = useDeferredValue(query, {
  // Only treat the value as a new deferred value when it changes by more than 300ms
  timeoutMs: 300,
  // Custom equality check
  isEqual: (prev, next) => prev.trim() === next.trim(),
});
```

## Scheduler API: Custom Priorities

React 20 exposes the underlying scheduling API, letting you assign priorities to specific updates. This is very useful in complex interaction scenarios:

```javascript
import { unstable_scheduleUpdate, Priority } from "react-scheduler";

function DragDropBoard() {
  const handleDrag = (item, position) => {
    // Real-time feedback during drag: highest priority
    unstable_scheduleUpdate({
      priority: Priority.Immediate,
      task: () => updateDragPosition(item, position),
    });
  };

  const handleDrop = (item, targetList) => {
    // Data sync after drop: normal priority
    unstable_scheduleUpdate({
      priority: Priority.Normal,
      task: () => persistDropOperation(item, targetList),
    });

    // Background analytics update: lowest priority
    unstable_scheduleUpdate({
      priority: Priority.Idle,
      task: () => trackAnalytics("item_moved", { item, targetList }),
    });
  };

  return <Board onDrag={handleDrag} onDrop={handleDrop} />;
}
```

Priority levels: `Immediate` > `UserBlocking` > `Normal` > `Low` > `Idle`. In practice, only use custom priorities for latency-sensitive scenarios like drag-and-drop, games, and real-time collaboration.

## Form Optimization in Concurrent Mode

React 20's concurrent features pair perfectly with the new Forms API. Immediate input responsiveness and deferred backend validation are naturally separated:

```javascript
import { useState, useTransition } from "react";
import { useField } from "react";

function AsyncValidationInput() {
  const [isPending, startTransition] = useTransition();

  const field = useField({
    name: "username",
    onChange: (value) => {
      // Input update is synchronous (high priority)
      // Validation is in a transition (low priority, can be interrupted)
      startTransition(() => {
        validateUsername(value);
      });
    },
  });

  return (
    <div>
      <input {...field.inputProps} />
      {isPending && <span className="hint">检查用户名可用性...</span>}
      {field.error && <span className="error">{field.error}</span>}
    </div>
  );
}
```

## Summary

- `useTransition` scheduling granularity is finer; stale updates are automatically discarded during rapid consecutive input
- `useDeferredValue` supports custom comparison functions and timeout control, cooperating with the Compiler to optimize rendering
- The Scheduler API exposes low-level priority control, suited for drag-and-drop/game-like high-interaction scenarios
- Concurrent features deeply integrate with Actions v2 and the new Forms API, forming a complete reactive system
- Concurrent mode is no longer "experimental" — it's the standard approach in React 20 for handling complex interactions
