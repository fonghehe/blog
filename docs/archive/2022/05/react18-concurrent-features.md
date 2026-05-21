---
title: "React 18 并发特性实战：useTransition 与 useDeferredValue"
date: 2022-05-10 10:39:10
tags:
  - React
readingTime: 3
description: "React 18 正式版发布两个月了，并发特性不再是实验室里的概念。这篇深入两个核心 API——`useTransition` 和 `useDeferredValue`，用真实场景讲解怎么在项目中落地。"
wordCount: 467
---

React 18 正式版发布两个月了，并发特性不再是实验室里的概念。这篇深入两个核心 API——`useTransition` 和 `useDeferredValue`，用真实场景讲解怎么在项目中落地。

## useTransition：标记低优先级更新

核心思想：不是所有状态更新都一样紧急。用户输入是紧急的，搜索结果更新是不紧急的。

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

`isPending` 告诉你 transition 还在进行中——可以用来显示加载状态，但输入框不会卡顿。

## useTransition 的真实场景

### 场景一：Tab 切换加载大量内容

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

点 Tab 时，按钮立即高亮（紧急更新），内容区域可以稍后更新（低优先级）。如果没有 transition，500ms 的渲染会让 Tab 点击延迟响应。

### 场景二：列表排序/过滤

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

## useDeferredValue：为已有状态加延迟

当你不能控制更新来源（比如 props 来自父组件），用 `useDeferredValue`：

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

`isStale` 的判断技巧：当原始值和延迟值不一致，说明延迟更新还在进行中，可以用视觉降级（降低透明度）提示用户。

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

| 特性 | useTransition | useDeferredValue |
|
------|--------------|-----------------|
| 控制权 | 包裹更新逻辑 | 延迟某个值 |
| 适用场景 | 事件处理中的状态更新 | props 或外部状态 |
| 返回值 | [isPending, startTransition] | deferredValue |
| 使用方式 | 嵌套 setState | 替代原始值 |

## 注意事项

1. **不是所有场景都需要 transition**：如果你的渲染很快（<16ms），不需要
2. **Suspense 配合**：transition 可以避免 Suspense fallback 闪烁
3. **不能用于受控输入**：输入框的 value 不应该用 deferredValue

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

## 小结

useTransition 和 useDeferredValue 是 React 18 并发特性的实际落地方式。它们的核心思想很简单：区分紧急更新和非紧急更新，让浏览器优先处理用户交互。不需要全面改造代码，在关键路径上用就行。