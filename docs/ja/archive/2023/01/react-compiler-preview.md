---
title: "React Compiler プレビューと仕組み"
date: 2023-01-19 11:47:06
tags:
  - React
readingTime: 4
description: "React Compiler（旧 React Forget）は React チームが開発中のコンパイル時最適化ツールです。その目標は useMemo、useCallback、React.memo の挿入を自動化し、開発者がこれらのパフォーマンス最適化を手動で管理する必要をなくすことです。本記事では公開情報に基づき、その動作原理と既存コードへの影響を分析します。"
wordCount: 1042
---

React Compiler（旧称 React Forget）は React チームが開発中のコンパイル時最適化ツールです。その目標は `useMemo`、`useCallback`、`React.memo` の挿入を自動化し、開発者がこれらのパフォーマンス最適化を手動で管理する必要をなくすことです。本記事では公開情報に基づき、その動作原理と既存コードへの影響を分析します。

## 現状：手動最適化の課題

React 18 では、パフォーマンス最適化は完全に開発者の手動処理に依存しています。コードは大量のボイラープレートで溢れています：

```tsx
// 最適化がない場合、親コンポーネントがレンダリングされるたびに関数とオブジェクトが再作成される
function Parent() {
  const [count, setCount] = useState(0)

  // レンダリングのたびに新しい参照が作成される
  const handleClick = () => console.log('clicked')
  const config = { step: 1 }

  return <Child onClick={handleClick} config={config} />
}

// 手動最適化後
function Parent() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => console.log('clicked'), [])
  const config = useMemo(() => ({ step: 1 }), [])

  return <Child onClick={handleClick} config={config} />
}

const Child = memo(function Child({ onClick, config }: Props) {
  // onClick または config の参照が変更されたときのみ再レンダリング
  return <div onClick={onClick}>Step: {config.step}</div>
})
```

この最適化パターンには2つの問題があります：1つは見落とし（memo化すべきものをmemo化しない）、もう1つは過剰なmemo化（不要なものまでmemo化する）です。どちらの場合もパフォーマンスが低下します。

## コンパイラーの仕組み

React Compiler は Babel プラグインであり、コンパイル段階でコンポーネントコードの依存関係を解析し、同等のメモ化ロジックを自動的に挿入します。

```tsx
// 開発者が書いたコード
function TodoList({ items, filter }: { items: Todo[], filter: string }) {
  const filtered = items.filter(item => item.text.includes(filter))
  const count = filtered.length

  return (
    <div>
      <p>共 {count} 条</p>
      {filtered.map(item => (
        <TodoItem key={item.id} item={item} />
      ))}
    </div>
  )
}

// Compiler が自動変換した同等のロジック（概念的な疑似コード）
function TodoList({ items, filter }: Props) {
  // 派生データに自動で memo を追加
  const filtered = useMemo(
    () => items.filter(item => item.text.includes(filter)),
    [items, filter]
  )
  const count = useMemo(() => filtered.length, [filtered])

  // コンポーネント参照に自動で安定化を追加
  return React.createElement('div', null,
    React.createElement('p', null, '共 ', count, ' 条'),
    filtered.map(item =>
      React.createElement(TodoItem, { key: item.id, item })
    )
  )
}
```

Compiler はコンポーネントの動作を変更せず、不必要な再計算と再レンダリングのみを最適化します。React Conf 2023 のデモによると、props が安定しているか、派生値をキャッシュする必要があるか、イベントハンドラに安定した参照が必要かを識別できます。

## 既存コードへの影響

React Compiler の目標は既存コードとの互換性です。コードがすでに手動で `useMemo`/`useCallback` を使用している場合、Compiler はそれを認識してスキップし、重複して挿入することはありません。

```tsx
// 既に手動 memo されたコードは、Compiler が重複処理しない
function Example() {
  const value = useMemo(() => expensiveCalc(), [dep])
  const handler = useCallback(() => doSomething(), [])
  // Compiler は既に memo 化されていることを認識し、スキップ
  return <Child value={value} onAction={handler} />
}

// ただし、Compiler が最適化できないパターンもある
function BadExample() {
  // 可変な ref 操作は、Compiler が安全に推論できない
  const ref = useRef(null)
  useEffect(() => {
    ref.current = document.getElementById('target')
  }, [])

  // 暗黙的な副作用は、Compiler が認識できない可能性がある
  const data = globalStore.getData() // 外部の可変状態
  return <div>{data}</div>
}
```

Compiler はコードが React のルールに従うことを要求します：props を変更しない、レンダリング時に副作用を実行しない、不変データに依存する。これはまさに `eslint-plugin-react-hooks` の `exhaustive-deps` と `hooks/rules` が常に強調していることです。

## コンパイル時最適化 vs ランタイム最適化

React Compiler は、React が純粋なランタイムフレームワークからコンパイル時補助フレームワークへと移行することを示しています。

```tsx
// ランタイム最適化（現在の方式）
// 開発者が手動で挿入し、実行時に比較を実行
const Child = memo(function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
})

// コンパイル時最適化（Compiler 方式）
// コンパイラが自動分析：items は props であり、変更がなければ再実行不要
function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
}
// コンパイル後は自動的に memo ロジックでラップされ、開発者の介入は不要
```

これは Svelte、SolidJS などのフレームワークの考え方と一致しています：コンパイル段階で可能な限り多くの分析を行い、ランタイムの作業を削減します。ただし、React は Svelte のように仮想 DOM を完全にコンパイルして排除することはありません。RSC や Server Components にはランタイムのシリアル化機能が必要だからです。

## まとめ

- React Compiler は自動的に `useMemo`/`useCallback`/`memo` を挿入し、開発者が手動でこれらの最適化を行う必要をなくすことを目標としています
- コンパイラはコードが React ルール（不変性、副作用のないレンダリング）に従うことを要求し、eslint ルールの厳格な遵守が Compiler 互換性の前提条件です
- 既に手動最適化されているコードは Compiler に影響されず、既存の memo 部分はスキップされます
- Compiler は React のコンパイル時最適化への移行を示していますが、仮想 DOM ランタイムを完全に放棄するわけではありません
- 現在 Compiler はまだ開発中ですが、新しいプロジェクトでは React ルールに従う習慣を身につけることをお勧めします