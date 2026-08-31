---
title: "React 18 Concurrent Features in Practice: useTransition and useDeferredValue"
date: 2022-05-10 10:39:10
tags:
  - React
readingTime: 3
description: "React 18 has been officially released for two months now, and concurrent features are no longer just lab concepts. This article dives into two core APIs — `useTransition` and `useDeferredValue` — with real-world scenarios showing how to use them in practice."
wordCount: 310
---

React 18 has been officially released for two months now, and concurrent features are no longer just lab concepts. This article dives into two core APIs — `useTransition` and `useDeferredValue` — with real-world scenarios showing how to use them in practice.

## useTransition: Marking Low-Priority Updates

The core idea: not all state updates are equally urgent. User input is urgent; search result updates are not.

```tsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value); // 紧急更新：输入框立即响应

    startTransition(() => {
      // 低优先级更新：搜索结果可以延迟
      const filtered = heavyFilter(value);
      setResults(filtered);
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending && <span>搜索中...</span>}
      <ul>
        {results.map(item => <li key={item.id}>{item.name}</li>)}
      </ul>
    </div>
  );
}
```

`isPending` tells you the transition is still in progress — you can use it to show a loading state, while the input stays responsive.

## Real-World useTransition Scenarios

### Scenario 1: Tab Switching with Heavy Content Loading

```tsx
function Dashboard() {
  const [tab, setTab] = useState('overview');
  const [isPending, startTransition] = useTransition();

  function switchTab(newTab: string) {
    startTransition(() => {
      setTab(newTab);
    });
  }

  return (
    <div>
      <nav>
        {['overview', 'analytics', 'settings'].map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            style={{ opacity: isPending && tab !== t ? 0.6 : 1 }}
          >
            {t}
          </button>
        ))}
      </nav>
      {isPending && <Spinner />}
      <TabContent tab={tab} />
    </div>
  );
}
```

When clicking a tab, the button highlights immediately (urgent update), while the content area can update later (low priority). Without transitions, a 500ms render would cause delayed feedback on tab clicks.

### Scenario 2: List Sorting/Filtering

```tsx
function DataTable({ data }: { data: DataRow[] }) {
  const [sortKey, setSortKey] = useState<string>('name');
  const [sorted, setSorted] = useState(data);
  const [isPending, startTransition] = useTransition();

  function handleSort(key: string) {
    setSortKey(key); // 紧急：按钮状态更新

    startTransition(() => {
      // 低优先级：排序结果
      const result = [...data].sort((a, b) =>
        a[key] > b[key] ? 1 : -1
      );
      setSorted(result);
    });
  }

  return (
    <div style={{ opacity: isPending ? 0.7 : 1 }}>
      <SortHeader sortKey={sortKey} onSort={handleSort} />
      <TableBody rows={sorted} />
    </div>
  );
}
```

## useDeferredValue: Deferring an Existing State

When you can't control the source of updates (e.g., props from a parent component), use `useDeferredValue`:

```tsx
import { useState, useDeferredValue, useMemo } from 'react';

function ProductList({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  // 当 filter 变化时，deferredFilter 延迟跟随
  // 这意味着输入框可以保持响应
  const visible = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(deferredFilter.toLowerCase())
    );
  }, [products, deferredFilter]);

  const isStale = filter !== deferredFilter;

  return (
    <div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="搜索产品..."
      />
      <ul style={{ opacity: isStale ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {visible.map(p => (
          <li key={p.id}>{p.name} - ¥{p.price}</li>
        ))}
      </ul>
    </div>
  );
}
```

The `isStale` trick: when the original value and deferred value differ, it means the deferred update is still in progress. You can use visual degradation (reduced opacity) to hint this to the user.

## useTransition vs useDeferredValue

```tsx
// useTransition：你控制更新的时机
function A() {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(() => {
      setState(newValue); // 你决定哪些 setState 是低优先级
    });
  }
}

// useDeferredValue：你控制值的延迟
function B({ data }) {
  const deferredData = useDeferredValue(data); // data 来自 props，你无法控制
  // 用 deferredData 做渲染
}
```

| Feature | useTransition | useDeferredValue |
|------|--------------|-----------------|
| Control | Wraps update logic | Defers a value |
| Use case | State updates in event handlers | Props or external state |
| Return value | [isPending, startTransition] | deferredValue |
| Usage | Nest setState calls | Replace the original value |

## Important Notes

1. **Not every scenario needs transitions**: if your renders are fast (<16ms), you don't need them
2. **Works with Suspense**: transitions can prevent Suspense fallback flickering
3. **Don't use on controlled inputs**: an input's value should not use deferredValue

```tsx
// 错误：输入框会卡顿
function Bad() {
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  return <input value={deferred} onChange={e => setText(e.target.value)} />;
}

// 正确：输入框即时响应，派生计算延迟
function Good() {
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  const results = useMemo(() => search(deferred), [deferred]);
  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      <Results data={results} />
    </>
  );
}
```

## Summary

useTransition and useDeferredValue are the practical implementation of React 18's concurrent features. The core idea is simple: distinguish between urgent and non-urgent updates, letting the browser prioritize user interactions. You don't need to overhaul your codebase — just apply them on critical paths.