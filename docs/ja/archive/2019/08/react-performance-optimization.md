---
title: "Reactパフォーマンス最適化：ProfilerからProdまで"
date: 2019-08-15 16:25:16
tags:
  - React
readingTime: 2
description: "React Profilerを使ってパフォーマンスに問題のあるページを分析し、最適化の方法論を整理した。"
wordCount: 287
---

React Profilerを使ってパフォーマンスに問題のあるページを分析し、最適化の方法論を整理した。

## まず分析、それから最適化

```jsx
// React DevTools Profilerを有効化
// ChromeにReact DevTools拡張機能をインストールし、Profilerタブに切り替え
// Recordをクリック、ページを操作、Stop、どのコンポーネントのレンダリングに時間がかかっているか確認

// コードレベル：Profilerコンポーネントの使用
import { Profiler } from "react";

function onRenderCallback(id, phase, actualDuration, baseDuration) {
  // id：Profilerのid
  // phase：mountまたはupdate
  // actualDuration：実際のレンダリング時間
  // baseDuration：キャッシュなしの推定時間

  if (actualDuration > 16) {
    // 16ms超過（60fpsの1フレーム分）
    console.warn(`${id} のレンダリングが遅すぎる: ${actualDuration}ms`);
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

## React.memo：不要な再レンダリングを防ぐ

```jsx
// 問題：親コンポーネントが更新されると、子コンポーネントも変化に関係なく再レンダリングされる
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveChild />  {/* 毎回再レンダリングされる！ */}
    </div>
  )
}

// 解決：React.memoでラップし、propsが変わらなければレンダリングをスキップ
const ExpensiveChild = React.memo(function ExpensiveChild({ data }) {
  return <div>{/* 复杂渲染 */}</div>
})

// カスタム比較関数（デフォルトは浅い比較）
const MemoizedList = React.memo(
  function List({ items, onSelect }) { ... },
  (prevProps, nextProps) => {
    return prevProps.items.length === nextProps.items.length &&
           prevProps.onSelect === nextProps.onSelect
  }
)
```

## useCallbackとuseMemo

```jsx
function ProductList({ category }) {
  const [items, setItems] = useState([]);

  // ❌ レンダリングごとに新しい関数を作成し、子コンポーネントの再レンダリングを引き起こす
  const handleSelect = (id) => {
    setSelectedId(id);
  };

  // ✅ 関数参照が安定
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []); // 依存なし、常に同じ関数

  // ❌ レンダリングごとに再フィルタリング
  const filtered = items.filter((item) => item.category === category);

  // ✅ 依存が変化した時のみ再計算
  const filtered = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category],
  );

  return (
    <ItemList
      items={filtered}
      onSelect={handleSelect} // 安定した参照により、ItemListは無駄に再レンダリングされない
    />
  );
}
```

## 仮想リスト（大量データ）

```jsx
// 表示領域内のitemのみをレンダリング
import { FixedSizeList } from "react-window";

function VirtualProductList({ products }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600} // コンテナの高さ
      itemCount={products.length}
      itemSize={100} // 各行の高さ
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
// 10000件のデータでも約6個のDOMノードのみレンダリング
```

## コード分割

```jsx
import { lazy, Suspense } from "react";

// ルートレベルの遅延読み込み
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

// 条件付き読み込み（使う時だけダウンロード）
function ReportPage() {
  const [showChart, setShowChart] = useState(false);
  const Chart = lazy(() => import("./HeavyChart"));

  return (
    <div>
      <button onClick={() => setShowChart(true)}>チャートを表示</button>
      {showChart && (
        <Suspense fallback={<Spinner />}>
          <Chart data={data} />
        </Suspense>
      )}
    </div>
  );
}
```

## 最適化の優先度

1. **不要なレンダリングの回避**（React.memo + useCallback/useMemo）- 最も一般的
2. **コード分割**（lazy + Suspense）- 初期ロード最適化
3. **仮想リスト**（react-window）- 大量データ対応
4. **Web Worker**（計算集約型タスク）- メインスレッドをブロックしない

## まとめ

- まずProfilerで問題を特定し、それから対象を絞って最適化する。闇雲な最適化は避ける
- `React.memo` と `useCallback`/`useMemo` を組み合わせて不要な再レンダリングを防ぐ
- リストが100件を超える場合は仮想リスト（react-window）を検討する
- コード分割は「無料」の最適化であり、ルートページはすべて遅延読み込みにすべき
