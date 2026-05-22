---
title: "React 20 併發特性成熟：特性解讀與遷移建議"
date: 2025-01-20 11:14:51
tags:
  - React
readingTime: 3
description: "React 20 的併發特性不再是實驗性功能。`useTransition`、`useDeferredValue` 和新的調度 API 全部進入穩定版，並且在底層做了大量效能優化。對於需要處理大量用户交互的複雜應用，這些特性終於可以放心用了。"
wordCount: 521
---

React 20 的併發特性不再是實驗性功能。`useTransition`、`useDeferredValue` 和新的調度 API 全部進入穩定版，並且在底層做了大量效能優化。對於需要處理大量用户交互的複雜應用，這些特性終於可以放心用了。

## useTransition 的實際應用

`useTransition` 最常見的用法是讓路由切換或大數據過濾不阻塞輸入。React 20 優化了 transition 的調度粒度，低優先級更新不再被高優先級長時間餓死。

```javascript
import { useState, useTransition, Suspense } from 'react';

function SearchableProductList({ products }) {
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleFilter = (e) => {
    // 立即更新輸入框（高優先級）
    setFilter(e.target.value);

    // 過濾計算放到 transition 中（低優先級）
    startTransition(() => {
      setFilteredProducts(
        products.filter(p =>
          p.name.toLowerCase().includes(e.target.value.toLowerCase())
        )
      );
    });
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        value={filter}
        onChange={handleFilter}
        placeholder="搜索產品..."
      />
      <div style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 150ms' }}>
        <ProductGrid products={filtered} />
      </div>
      {isPending && <Spinner position="top-right" />}
    </div>
  );
}
```

React 20 的改進在於：transition 內的狀態更新可以中斷和恢復。當你連續快速輸入時，React 會丟棄中間的過時計算，隻執行最後一次。

## useDeferredValue 的自動記憶化

`useDeferredValue` 在 React 20 中獲得了編譯器優化的支援。它不再簡單地延遲值傳遞，而是與 React Compiler 協作，隻重新渲染真正需要更新的子樹。

```javascript
import { useState, useDeferredValue, memo } from 'react';

// React 20 Compiler 會自動優化這個組件
// 不需要手動寫 memo
function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  // 當 query 變化時，input 立即更新
  // filteredProducts 使用 deferredQuery，更新被延遲
  const filteredProducts = useMemo(
    () => filterProducts(deferredQuery),
    [deferredQuery]
  );

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

關鍵變化是 `useDeferredValue` 現在支持自定義比較函數：

```javascript
// React 20 新增：自定義比較邏輯
const deferredQuery = useDeferredValue(query, {
  // 隻有當值變化超過 300ms 才認為是新的 deferred 值
  timeoutMs: 300,
  // 自定義相等性檢查
  isEqual: (prev, next) => prev.trim() === next.trim(),
});
```

## Scheduler API：自定義優先級

React 20 暴露了底層調度 API，讓你可以為特定更新指定優先級。這在複雜交互場景中非常有用：

```javascript
import { unstable_scheduleUpdate, Priority } from 'react-scheduler';

function DragDropBoard() {
  const handleDrag = (item, position) => {
    // 拖拽時的實時反饋：最高優先級
    unstable_scheduleUpdate({
      priority: Priority.Immediate,
      task: () => updateDragPosition(item, position),
    });
  };

  const handleDrop = (item, targetList) => {
    // 放下後的數據同步：普通優先級
    unstable_scheduleUpdate({
      priority: Priority.Normal,
      task: () => persistDropOperation(item, targetList),
    });

    // 後臺統計更新：最低優先級
    unstable_scheduleUpdate({
      priority: Priority.Idle,
      task: () => trackAnalytics('item_moved', { item, targetList }),
    });
  };

  return <Board onDrag={handleDrag} onDrop={handleDrop} />;
}
```

Priority 級別：`Immediate` > `UserBlocking` > `Normal` > `Low` > `Idle`。在實際項目中，建議隻在拖拽、遊戲、實時協作等對延遲敏感的場景中使用自定義優先級。

## 併發模式下的表單優化

React 20 的併發特性與新表單 API 完美配合。輸入框的即時響應和後端驗證的延遲執行天然分離：

```javascript
import { useState, useTransition } from 'react';
import { useField } from 'react';

function AsyncValidationInput() {
  const [isPending, startTransition] = useTransition();

  const field = useField({
    name: 'username',
    onChange: (value) => {
      // 輸入更新是同步的（高優先級）
      // 驗證在 transition 中（低優先級，可中斷）
      startTransition(() => {
        validateUsername(value);
      });
    },
  });

  return (
    <div>
      <input {...field.inputProps} />
      {isPending && <span className="hint">檢查用户名可用性...</span>}
      {field.error && <span className="error">{field.error}</span>}
    </div>
  );
}
```

## 小結

- useTransition 調度粒度更細，連續快速輸入時自動丟棄過時更新
- useDeferredValue 支援自定義比較函數和超時控製，與 Compiler 協作優化渲染
- Scheduler API 暴露底層優先級控製，適合拖拽/遊戲等高交互場景
- 併發特性與 Actions v2、新表單 API 深度集成，形成完整的響應式體系
- 併發模式不再是「實驗性功能」，而是 React 20 處理複雜交互的標準方案
