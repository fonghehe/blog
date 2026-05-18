---
title: "React 性能优化：从 Profiler 到实战"
date: 2019-08-15 16:25:16
tags:
  - React
readingTime: 2
description: "用 React Profiler 分析了一个性能有问题的页面，整理出一套优化方法论。"
---

用 React Profiler 分析了一个性能有问题的页面，整理出一套优化方法论。

## 先分析，后优化

```jsx
// 开启 React DevTools Profiler
// Chrome 安装 React DevTools 扩展，切到 Profiler 标签
// 点 Record，操作页面，Stop，看哪些组件渲染耗时

// 代码层面：使用 Profiler 组件
import { Profiler } from "react";

function onRenderCallback(id, phase, actualDuration, baseDuration) {
  // id：Profiler 的 id
  // phase：mount 或 update
  // actualDuration：实际渲染时间
  // baseDuration：不缓存时的预估时间

  if (actualDuration > 16) {
    // 超过 16ms（60fps 的一帧）
    console.warn(`${id} 渲染太慢: ${actualDuration}ms`);
  }
}

function App() {
  return (
    <Profiler id="ProductList" onRender={onRenderCallback}>
      <ProductList />
    </Profiler>
  );
}
```

## React.memo：避免不必要的重渲染

```jsx
// 问题：父组件更新，子组件不管有没有变化都重渲染
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveChild />  {/* 每次都重渲染！ */}
    </div>
  )
}

// 解决：React.memo 包裹，props 不变就跳过渲染
const ExpensiveChild = React.memo(function ExpensiveChild({ data }) {
  return <div>{/* 复杂渲染 */}</div>
})

// 自定义比较函数（默认浅比较）
const MemoizedList = React.memo(
  function List({ items, onSelect }) { ... },
  (prevProps, nextProps) => {
    return prevProps.items.length === nextProps.items.length &&
           prevProps.onSelect === nextProps.onSelect
  }
)
```

## useCallback 和 useMemo

```jsx
function ProductList({ category }) {
  const [items, setItems] = useState([]);

  // ❌ 每次渲染都创建新函数，导致子组件重渲染
  const handleSelect = (id) => {
    setSelectedId(id);
  };

  // ✅ 函数引用稳定
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []); // 没有依赖，始终是同一个函数

  // ❌ 每次渲染都重新过滤
  const filtered = items.filter((item) => item.category === category);

  // ✅ 只有依赖变化时才重新计算
  const filtered = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category],
  );

  return (
    <ItemList
      items={filtered}
      onSelect={handleSelect} // 稳定的引用，ItemList 不会无端重渲染
    />
  );
}
```

## 虚拟列表（大数据量）

```jsx
// 只渲染可视区域内的 item
import { FixedSizeList } from "react-window";

function VirtualProductList({ products }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600} // 容器高度
      itemCount={products.length}
      itemSize={100} // 每行高度
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
// 10000 条数据也只渲染 ~6 个 DOM 节点
```

## 代码分割

```jsx
import { lazy, Suspense } from "react";

// 路由级别懒加载
const Dashboard = lazy(() => import("./Dashboard"));
const Analytics = lazy(() => import("./Analytics"));

function App() {
  return (
    <Router>
      <Suspense fallback={<PageSkeleton />}>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/analytics" component={Analytics} />
      </Suspense>
    </Router>
  );
}

// 条件加载（只有用到时才下载）
function ReportPage() {
  const [showChart, setShowChart] = useState(false);
  const Chart = lazy(() => import("./HeavyChart"));

  return (
    <div>
      <button onClick={() => setShowChart(true)}>显示图表</button>
      {showChart && (
        <Suspense fallback={<Spinner />}>
          <Chart data={data} />
        </Suspense>
      )}
    </div>
  );
}
```

## 优化优先级

1. **避免不必要渲染**（React.memo + useCallback/useMemo）- 最常见
2. **代码分割**（lazy + Suspense）- 首屏加载优化
3. **虚拟列表**（react-window）- 大数据量
4. **Web Worker**（计算密集型任务）- 不阻塞主线程

## 小结

- 先 Profiler 定位问题，再针对性优化，不要盲目优化
- `React.memo` 配合 `useCallback`/`useMemo` 阻止不必要的重渲染
- 列表超过 100 条就考虑虚拟列表（react-window）
- 代码分割是"免费"的优化，路由页面都应该懒加载
