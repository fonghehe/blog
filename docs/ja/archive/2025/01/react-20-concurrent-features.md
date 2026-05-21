---
title: "React 20 Concurrent機能の深掘り：useTransition、useDeferredValue、Scheduler API"
date: 2025-01-20 10:00:00
tags:
  - React
readingTime: 2
description: "React 18でConcurrentモードが導入されてから、`useTransition`と`useDeferredValue`はReactの高度な最適化ツールとして広く使われてきました。React 20はこれらのAPIを改善し、新しい`Scheduler` APIも追加されました。本記事ではこれらの実践的な使い方を"
wordCount: 307
---

React 18でConcurrentモードが導入されてから、`useTransition`と`useDeferredValue`はReactの高度な最適化ツールとして広く使われてきました。React 20はこれらのAPIを改善し、新しい`Scheduler` APIも追加されました。本記事ではこれらの実践的な使い方を深掘りします。

## useTransitionの改善：より自然なローディング状態管理

React 20の`useTransition`は、transition中のサスペンスフォールバックの挙動が改善されました。

```typescript
import { useTransition, Suspense } from "react";

function TabContainer() {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("home");

  const switchTab = (tab: string) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div>
      <nav>
        {["home", "profile", "settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            style={{
              // React 20 改善：isPending は「このタブへの遷移が進行中」を正確に反映
              opacity: isPending && activeTab !== tab ? 0.6 : 1,
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* isPending 中は古いコンテンツを表示し続け、フォールバックを表示しない */}
      <Suspense fallback={<TabSkeleton />}>
        <TabContent tab={activeTab} />
      </Suspense>
    </div>
  );
}
```

### useTransitionと非同期操作

React 20では`startTransition`がPromiseを受け取れるようになりました：

```typescript
function SearchPage() {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = (query: string) => {
    startTransition(async () => {
      // React 20：startTransition 内で async/await が使える
      const data = await fetchSearchResults(query);
      setResults(data);
    });
  };

  return (
    <div>
      <SearchInput onSearch={handleSearch} />
      {isPending ? <SearchSkeleton /> : <ResultsList results={results} />}
    </div>
  );
}
```

## useDeferredValueの実用パターン

```typescript
import { useDeferredValue, useMemo } from "react";

function FilterableList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");

  // deferredQuery は query より1フレーム遅れて更新される
  // → 入力中は古い deferredQuery でフィルタリング結果を表示し続ける（入力がブロックされない）
  const deferredQuery = useDeferredValue(query);

  // deferredQuery ベースのフィルタリングは、入力と同じフレームでは走らない
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        item.name.toLowerCase().includes(deferredQuery.toLowerCase()),
      ),
    [items, deferredQuery],
  );

  const isStale = query !== deferredQuery; // 古い結果を表示中かどうか

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="フィルタリング..."
      />

      {/* 古い結果を表示中は薄く表示して「更新中」を伝える */}
      <ul style={{ opacity: isStale ? 0.6 : 1, transition: "opacity 0.2s" }}>
        {filteredItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## 新しいScheduler API（実験的）

React 20は内部スケジューラーを公開する`Scheduler` APIを実験的に追加しました。

```typescript
import {
  unstable_scheduleCallback,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_IdlePriority,
} from "scheduler";

// 優先度を指定してタスクをスケジュール
function processLargeDataset(data: DataPoint[]) {
  let index = 0;

  function processChunk() {
    // 1チャンク：1000件
    const end = Math.min(index + 1000, data.length);

    while (index < end) {
      processItem(data[index]);
      index++;
    }

    if (index < data.length) {
      // まだ処理が残っていれば、次の空き時間に再スケジュール（Idle 優先度）
      unstable_scheduleCallback(unstable_IdlePriority, processChunk);
    }
  }

  // 最初の実行はNormal優先度
  unstable_scheduleCallback(unstable_NormalPriority, processChunk);
}
```

```typescript
// useTransition + Scheduler の組み合わせ
function DataAnalysisPage({ rawData }: { rawData: DataPoint[] }) {
  const [isPending, startTransition] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const runAnalysis = () => {
    startTransition(async () => {
      // 重い計算を Scheduler でバックグラウンド処理
      const result = await new Promise<AnalysisResult>((resolve) => {
        unstable_scheduleCallback(unstable_IdlePriority, () => {
          const r = heavyAnalysis(rawData);
          resolve(r);
        });
      });
      setAnalysisResult(result);
    });
  };

  return (
    <div>
      <button onClick={runAnalysis} disabled={isPending}>
        {isPending ? "分析中..." : "分析開始"}
      </button>
      {analysisResult && <AnalysisReport data={analysisResult} />}
    </div>
  );
}
```

## useTransition vs useDeferredValue の使い分け

```
使い分けガイド：

useTransition（イベントハンドラーがある場合）：
  - ボタンクリック、タブ切り替えなど、明示的な操作によって状態遷移が発生するとき
  - startTransition で「低優先度の状態更新」を明示的にマーク
  - isPending で遷移の進捗をUIに反映できる

useDeferredValue（プロップが変化する場合）：
  - 親から受け取ったプロップの変化によって重い計算が走るとき
  - 入力のような高頻度な更新に対して「後追い更新」を実現したいとき
  - 古い値（deferred value）と新しい値（現在値）を比較してスタール状態を検知できる
```

## まとめ

React 20のConcurrent機能の改善は、`useTransition`の非同期サポートと`Scheduler` APIの公開によって、UIの応答性を損なわずに重い処理を扱う選択肢が増えました。これらを適切に使い分けることで、Reactアプリケーションのパフォーマンスを大幅に改善できます。
