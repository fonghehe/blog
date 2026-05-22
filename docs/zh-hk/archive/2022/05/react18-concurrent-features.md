---
title: "React 18 併發特性實戰：useTransition 與 useDeferredValue"
date: 2022-05-10 10:39:10
tags:
  - React
readingTime: 3
description: "React 18 正式版發佈兩個月了，併發特性不再是實驗室裏的概念。這篇深入兩個核心 API——`useTransition` 和 `useDeferredValue`，用真實場景講解怎麼在項目中落地。"
wordCount: 467
---

React 18 正式版發佈兩個月了，併發特性不再是實驗室裏的概念。這篇深入兩個核心 API——`useTransition` 和 `useDeferredValue`，用真實場景講解怎麼在項目中落地。

## useTransition：標記低優先級更新

核心思想：不是所有狀態更新都一樣緊急。用户輸入是緊急的，搜索結果更新是不緊急的。

```tsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value); // 緊急更新：輸入框立即響應

    startTransition(() => {
      // 低優先級更新：搜索結果可以延遲
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

`isPending` 告訴你 transition 還在進行中——可以用來顯示加載狀態，但輸入框不會卡頓。

## useTransition 的真實場景

### 場景一：Tab 切換加載大量內容

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

點 Tab 時，按鈕立即高亮（緊急更新），內容區域可以稍後更新（低優先級）。如果沒有 transition，500ms 的渲染會讓 Tab 點擊延遲響應。

### 場景二：列表排序/過濾

```tsx
function DataTable({ data }: { data: DataRow[] }) {
  const [sortKey, setSortKey] = useState<string>('name');
  const [sorted, setSorted] = useState(data);
  const [isPending, startTransition] = useTransition();

  function handleSort(key: string) {
    setSortKey(key); // 緊急：按鈕狀態更新

    startTransition(() => {
      // 低優先級：排序結果
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

## useDeferredValue：為已有狀態加延遲

當你不能控製更新來源（比如 props 來自父組件），用 `useDeferredValue`：

```tsx
import { useState, useDeferredValue, useMemo } from 'react';

function ProductList({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  // 當 filter 變化時，deferredFilter 延遲跟隨
  // 這意味着輸入框可以保持響應
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
        placeholder="搜索產品..."
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

`isStale` 的判斷技巧：當原始值和延遲值不一致，説明延遲更新還在進行中，可以用視覺降級（降低透明度）提示用户。

## useTransition vs useDeferredValue

```tsx
// useTransition：你控製更新的時機
function A() {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(() => {
      setState(newValue); // 你決定哪些 setState 是低優先級
    });
  }
}

// useDeferredValue：你控製值的延遲
function B({ data }) {
  const deferredData = useDeferredValue(data); // data 來自 props，你無法控製
  // 用 deferredData 做渲染
}
```

| 特性 | useTransition | useDeferredValue |
|
------|--------------|-----------------|
| 控製權 | 包裹更新邏輯 | 延遲某個值 |
| 適用場景 | 事件處理中的狀態更新 | props 或外部狀態 |
| 返回值 | [isPending, startTransition] | deferredValue |
| 使用方式 | 嵌套 setState | 替代原始值 |

## 注意事項

1. **不是所有場景都需要 transition**：如果你的渲染很快（<16ms），不需要
2. **Suspense 配合**：transition 可以避免 Suspense fallback 閃爍
3. **不能用於受控輸入**：輸入框的 value 不應該用 deferredValue

```tsx
// 錯誤：輸入框會卡頓
function Bad() {
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  return <input value={deferred} onChange={e => setText(e.target.value)} />;
}

// 正確：輸入框即時響應，派生計算延遲
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

## 小結

useTransition 和 useDeferredValue 是 React 18 併發特性的實際落地方式。它們的核心思想很簡單：區分緊急更新和非緊急更新，讓瀏覽器優先處理用户交互。不需要全面改造代碼，在關鍵路徑上用就行。