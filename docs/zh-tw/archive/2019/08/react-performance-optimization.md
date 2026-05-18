---
title: "React 效能最佳化：從 Profiler 到實戰"
date: 2019-08-15 16:25:16
tags:
  - React
readingTime: 2
description: "用 React Profiler 分析了一個性能有問題的頁面，整理出一套最佳化方法論。"
---

用 React Profiler 分析了一個性能有問題的頁面，整理出一套最佳化方法論。

## 先分析，後最佳化

```jsx
// 開啟 React DevTools Profiler
// Chrome 安裝 React DevTools 擴充套件，切到 Profiler 標籤
// 點 Record，操作頁面，Stop，看哪些元件渲染耗時

// 程式碼層面：使用 Profiler 元件
import { Profiler } from "react";

function onRenderCallback(id, phase, actualDuration, baseDuration) {
  // id：Profiler 的 id
  // phase：mount 或 update
  // actualDuration：實際渲染時間
  // baseDuration：不快取時的預估時間

  if (actualDuration > 16) {
    // 超過 16ms（60fps 的一幀）
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
// 問題：父元件更新，子元件不管有沒有變化都重渲染
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveChild />  {/* 每次都重渲染！ */}
    </div>
  )
}

// 解決：React.memo 包裹，props 不變就跳過渲染
const ExpensiveChild = React.memo(function ExpensiveChild({ data }) {
  return <div>{/* 複雜渲染 */}</div>
})

// 自定義比較函式（預設淺比較）
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

  // ❌ 每次渲染都建立新函式，導致子元件重渲染
  const handleSelect = (id) => {
    setSelectedId(id);
  };

  // ✅ 函式引用穩定
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []); // 沒有依賴，始終是同一個函式

  // ❌ 每次渲染都重新過濾
  const filtered = items.filter((item) => item.category === category);

  // ✅ 只有依賴變化時才重新計算
  const filtered = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category],
  );

  return (
    <ItemList
      items={filtered}
      onSelect={handleSelect} // 穩定的引用，ItemList 不會無端重渲染
    />
  );
}
```

## 虛擬列表（大數據量）

```jsx
// 只渲染可視區域內的 item
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
// 10000 條資料也只渲染 ~6 個 DOM 節點
```

## 程式碼分割

```jsx
import { lazy, Suspense } from "react";

// 路由級別懶載入
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

// 條件載入（只有用到時才下載）
function ReportPage() {
  const [showChart, setShowChart] = useState(false);
  const Chart = lazy(() => import("./HeavyChart"));

  return (
    <div>
      <button onClick={() => setShowChart(true)}>顯示圖表</button>
      {showChart && (
        <Suspense fallback={<Spinner />}>
          <Chart data={data} />
        </Suspense>
      )}
    </div>
  );
}
```

## 最佳化優先順序

1. **避免不必要渲染**（React.memo + useCallback/useMemo）- 最常見
2. **程式碼分割**（lazy + Suspense）- 首屏載入最佳化
3. **虛擬列表**（react-window）- 大數據量
4. **Web Worker**（計算密集型任務）- 不阻塞主執行緒

## 小結

- 先 Profiler 定位問題，再針對性最佳化，不要盲目最佳化
- `React.memo` 配合 `useCallback`/`useMemo` 阻止不必要的重渲染
- 列表超過 100 條就考慮虛擬列表（react-window）
- 程式碼分割是"免費"的最佳化，路由頁面都應該懶載入
