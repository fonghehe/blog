---
title: "React 18 並行機能の実践：useTransition と useDeferredValue"
date: 2022-05-10 10:39:10
tags:
  - React
readingTime: 4
description: "React 18 正式版がリリースされて2ヶ月が経ち、並行機能はもはや実験室の概念ではなくなりました。この記事では、2つの核心 API——useTransition と useDeferredValue——を掘り下げ、実際のシナリオを用いてプロジェクトでの適用方法を解説します。"
wordCount: 775
---

React 18 正式版がリリースされて 2 ヶ月が経ち、並行機能はもはや実験室の概念ではなくなりました。この記事では、2 つのコア API——`useTransition` と `useDeferredValue`——を掘り下げ、実際のシナリオを用いてプロジェクトでの適用方法を解説します。

## useTransition：低優先度更新のマーク

核心的な考え方：すべての状態更新が同じ緊急度とは限りません。ユーザー入力は緊急ですが、検索結果の更新は緊急ではありません。

```tsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value); // 緊急更新：入力欄が即座に応答

    startTransition(() => {
      // 低優先度更新：検索結果は遅延させてもよい
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

`isPending` は transition が進行中であることを示します——ローディング状態の表示に使用できますが、入力欄がカクつくことはありません。

## useTransition の実際のユースケース

### シナリオ1：Tab 切り替えで大量コンテンツをロード

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

Tab をクリックすると、ボタンは即座にハイライトされ（緊急更新）、コンテンツ領域は後で更新されます（低優先度）。transition がない場合、500ms のレンダリングにより Tab クリックの応答が遅延します。

### シナリオ2：リストのソート/フィルタリング

```tsx
function DataTable({ data }: { data: DataRow[] }) {
  const [sortKey, setSortKey] = useState<string>('name');
  const [sorted, setSorted] = useState(data);
  const [isPending, startTransition] = useTransition();

  function handleSort(key: string) {
    setSortKey(key); // 緊急：ボタン状態の更新

    startTransition(() => {
      // 低優先度：ソート結果
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

## useDeferredValue：既存の状態に遅延を追加

更新の発生元を制御できない場合（props が親コンポーネントから来る場合など）、`useDeferredValue` を使用します：

```tsx
import { useState, useDeferredValue, useMemo } from 'react';

function ProductList({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  // filter が変化すると、deferredFilter は遅れて追従
  // これにより入力欄の応答性が維持される
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

`isStale` の判定テクニック：元の値と遅延値が一致しない場合、遅延更新が進行中であることを示し、視覚的な劣化（透明度を下げる）でユーザーに知らせることができます。

## useTransition vs useDeferredValue

```tsx
// useTransition：更新のタイミングを制御
function A() {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(() => {
      setState(newValue); // どの setState が低優先度かを決定
    });
  }
}

// useDeferredValue：値の遅延を制御
function B({ data }) {
  const deferredData = useDeferredValue(data); // data は props から来るため、制御できない
  // deferredData を使ってレンダリング
}
```

| 特性 | useTransition | useDeferredValue |
|------|--------------|-----------------|
| 制御権 | 更新ロジックをラップ | 値を遅延させる |
| 適用シナリオ | イベント処理内の状態更新 | props または外部状態 |
| 戻り値 | [isPending, startTransition] | deferredValue |
| 使用方法 | setState をネスト | 元の値を置き換える |

## 注意事項

1. **すべてのシナリオで transition が必要なわけではありません**：レンダリングが高速（<16ms）な場合は不要です
2. **Suspense との連携**：transition は Suspense の fallback ちらつきを防げます
3. **制御された入力には使用不可**：入力欄の value に deferredValue を使うべきではありません

```tsx
// 誤り：入力欄がカクつく
function Bad() {
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  return <input value={deferred} onChange={e => setText(e.target.value)} />;
}

// 正しい：入力欄は即座に応答し、派生計算は遅延
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

## まとめ

useTransition と useDeferredValue は、React 18 の並行機能を実際に活用する方法です。それらの核となる考え方はシンプルです：緊急の更新と非緊急の更新を区別し、ブラウザがユーザーインタラクションを優先的に処理できるようにします。コードを全面的に書き換える必要はなく、クリティカルパスで使用するだけで十分です。
