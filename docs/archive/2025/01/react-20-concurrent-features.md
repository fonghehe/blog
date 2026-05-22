---
title: "React 20 并发特性成熟"
date: 2025-01-20 11:14:51
tags:
  - React
readingTime: 3
description: "React 20 的并发特性不再是实验性功能。`useTransition`、`useDeferredValue` 和新的调度 API 全部进入稳定版，并且在底层做了大量性能优化。对于需要处理大量用户交互的复杂应用，这些特性终于可以放心用了。"
wordCount: 521
---

React 20 的并发特性不再是实验性功能。`useTransition`、`useDeferredValue` 和新的调度 API 全部进入稳定版，并且在底层做了大量性能优化。对于需要处理大量用户交互的复杂应用，这些特性终于可以放心用了。

## useTransition 的实际应用

`useTransition` 最常见的用法是让路由切换或大数据过滤不阻塞输入。React 20 优化了 transition 的调度粒度，低优先级更新不再被高优先级长时间饿死。

```javascript
import { useState, useTransition, Suspense } from 'react';

function SearchableProductList({ products }) {
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleFilter = (e) => {
    // 立即更新输入框（高优先级）
    setFilter(e.target.value);

    // 过滤计算放到 transition 中（低优先级）
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
        placeholder="搜索产品..."
      />
      <div style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 150ms' }}>
        <ProductGrid products={filtered} />
      </div>
      {isPending && <Spinner position="top-right" />}
    </div>
  );
}
```

React 20 的改进在于：transition 内的状态更新可以中断和恢复。当你连续快速输入时，React 会丢弃中间的过时计算，只执行最后一次。

## useDeferredValue 的自动记忆化

`useDeferredValue` 在 React 20 中获得了编译器优化的支持。它不再简单地延迟值传递，而是与 React Compiler 协作，只重新渲染真正需要更新的子树。

```javascript
import { useState, useDeferredValue, memo } from 'react';

// React 20 Compiler 会自动优化这个组件
// 不需要手动写 memo
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

  // 当 query 变化时，input 立即更新
  // filteredProducts 使用 deferredQuery，更新被延迟
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

关键变化是 `useDeferredValue` 现在支持自定义比较函数：

```javascript
// React 20 新增：自定义比较逻辑
const deferredQuery = useDeferredValue(query, {
  // 只有当值变化超过 300ms 才认为是新的 deferred 值
  timeoutMs: 300,
  // 自定义相等性检查
  isEqual: (prev, next) => prev.trim() === next.trim(),
});
```

## Scheduler API：自定义优先级

React 20 暴露了底层调度 API，让你可以为特定更新指定优先级。这在复杂交互场景中非常有用：

```javascript
import { unstable_scheduleUpdate, Priority } from 'react-scheduler';

function DragDropBoard() {
  const handleDrag = (item, position) => {
    // 拖拽时的实时反馈：最高优先级
    unstable_scheduleUpdate({
      priority: Priority.Immediate,
      task: () => updateDragPosition(item, position),
    });
  };

  const handleDrop = (item, targetList) => {
    // 放下后的数据同步：普通优先级
    unstable_scheduleUpdate({
      priority: Priority.Normal,
      task: () => persistDropOperation(item, targetList),
    });

    // 后台统计更新：最低优先级
    unstable_scheduleUpdate({
      priority: Priority.Idle,
      task: () => trackAnalytics('item_moved', { item, targetList }),
    });
  };

  return <Board onDrag={handleDrag} onDrop={handleDrop} />;
}
```

Priority 级别：`Immediate` > `UserBlocking` > `Normal` > `Low` > `Idle`。在实际项目中，建议只在拖拽、游戏、实时协作等对延迟敏感的场景中使用自定义优先级。

## 并发模式下的表单优化

React 20 的并发特性与新表单 API 完美配合。输入框的即时响应和后端验证的延迟执行天然分离：

```javascript
import { useState, useTransition } from 'react';
import { useField } from 'react';

function AsyncValidationInput() {
  const [isPending, startTransition] = useTransition();

  const field = useField({
    name: 'username',
    onChange: (value) => {
      // 输入更新是同步的（高优先级）
      // 验证在 transition 中（低优先级，可中断）
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

## 小结

- useTransition 调度粒度更细，连续快速输入时自动丢弃过时更新
- useDeferredValue 支持自定义比较函数和超时控制，与 Compiler 协作优化渲染
- Scheduler API 暴露底层优先级控制，适合拖拽/游戏等高交互场景
- 并发特性与 Actions v2、新表单 API 深度集成，形成完整的响应式体系
- 并发模式不再是「实验性功能」，而是 React 20 处理复杂交互的标准方案
