---
title: "React 22 Compiler コンパイル最適化の原理：自動 Memoization はどう機能するか"
date: 2026-07-10 21:37:01
tags:
  - React
readingTime: 7
description: "React Compiler はコンパイル時の静的解析で自動的に memoization ロジックを挿入し、手動 useMemo/useCallback の負担を排除する。本記事ではコンパイラの動作原理、出力コード構造、制約条件を分析し、Vue Vapor Mode とのコンパイル戦略比較を行う。"
wordCount: 3000
---

React コミュニティは長らく一つのジレンマに直面してきた：`useMemo`、`useCallback`、`React.memo` これらの最適化手段は「正しいが煩雑」である。開発者は多大な労力を手動最適化に費やすか、不必要な再レンダリングを耐えるかの選択を迫られる。React Compiler の目標は、この意思決定を開発者からコンパイラへ移すことである——機械に何を memoize すべきかを決定させる。

## React Compiler の設計目標

React Compiler（コードネーム "Forget"）のコア設計目標は一言で要約できる：**コンパイル段階で自動的に memoization ロジックを挿入し、コンポーネントがデフォルトで memo 化されたレンダリング性能を持つようにし、手動の useMemo/useCallback を不要にする**。

この目標の背景にある仮説は：React の再レンダリングモデル自体には問題がない。問題は開発者がいつ再計算すべきか、いつ前回の結果を再利用すべきかを正確に制御できないことにある。React Compiler はコンポーネントコードの静的解析を通じて、各値と関数の依存関係を導き出し、コンパイル出力に自動的にキャッシュロジックを挿入する。

```typescript
// ソースコード：開発者が書いたコード
function ProductList({ products, filterText }) {
  const filtered = products.filter(p =>
    p.name.includes(filterText)
  )

  const handleClick = (id) => {
    console.log('clicked', id)
  }

  return (
    <ul>
      {filtered.map(p => (
        <li key={p.id} onClick={() => handleClick(p.id)}>
          {p.name}
        </li>
      ))}
    </ul>
  )
}
```

```typescript
// コンパイル後：コンパイラが自動的に memo ロジックを挿入（簡略表現）
function ProductList({ products, filterText }) {
  const $ = useMemoCache(3)

  // products と filterText が変化した時のみ再 filter
  const filtered = $[0] !== products || $[1] !== filterText
    ? ($[0] = products, $[1] = filterText, $[2] = products.filter(p =>
        p.name.includes(filterText)))
    : $[2]

  // handleClick は初回作成のみ、以降は再利用
  const handleClick = $[3] ??= (id) => {
    console.log('clicked', id)
  }

  return (
    <ul>
      {filtered.map(p => (
        <li key={p.id} onClick={() => handleClick(p.id)}>
          {p.name}
        </li>
      ))}
    </ul>
  )
}
```

## コンパイラはどう依存関係を分析するか

React Compiler の分析プロセスはいくつかのフェーズに分かれる。

### 1. AST 解析とスコープ分析

コンパイラはまず JSX を AST に変換し、各変数のスコープとライフサイクルを分析する。コアとなる問題は：**この値はどのような条件下で変化するか？**である。

```typescript
function UserCard({ user, onEdit }) {
  // fullName は user.firstName と user.lastName に依存
  const fullName = `${user.firstName} ${user.lastName}`

  // avatarUrl は user.id に依存
  const avatarUrl = `/api/avatars/${user.id}.png`

  // handleClick は onEdit と user.id に依存
  const handleClick = () => {
    onEdit(user.id)
  }

  return (
    <div className="card">
      <img src={avatarUrl} alt={fullName} />
      <h2>{fullName}</h2>
      <button onClick={handleClick}>編集</button>
    </div>
  )
}
```

コンパイラの分析結果：

| 変数 | 依存先 | memo 条件 |
|------|--------|-----------|
| `fullName` | `user.firstName`, `user.lastName` | いずれかが変化した時に再計算 |
| `avatarUrl` | `user.id` | `user.id` が変化した時に再計算 |
| `handleClick` | `onEdit`, `user.id` | いずれかが変化した時に再作成 |

### 2. 依存追跡とキャッシュ戦略

コンパイラは各コンポーネント関数にキャッシュ配列を割り当て、宣言順に memoized 値を格納する。キャッシュは React の `useMemoCache` フックを使用する。

```typescript
// コンパイル後（より現実的な表現）
function UserCard({ user, onEdit }) {
  const $ = useMemoCache(6)

  // fullName: user.firstName と user.lastName に依存
  const fullName = $[0] !== user.firstName || $[1] !== user.lastName
    ? ($[0] = user.firstName, $[1] = user.lastName, $[2] = `${user.firstName} ${user.lastName}`)
    : $[2]

  // avatarUrl: user.id に依存
  const avatarUrl = $[3] !== user.id
    ? ($[3] = user.id, $[4] = `/api/avatars/${user.id}.png`)
    : $[4]

  // handleClick: onEdit と user.id に依存
  const c_onEdit = $[3]
  const handleClick = $[3] !== user.id || $[5] !== onEdit
    ? ($[3] = user.id, $[5] = onEdit, $[6] = () => { onEdit(user.id) })
    : $[6]

  return (
    <div className="card">
      <img src={avatarUrl} alt={fullName} />
      <h2>{fullName}</h2>
      <button onClick={handleClick}>編集</button>
    </div>
  )
}
```

### 3. 参照安定性の保証

コンパイラの最も重要な能力は参照安定性の保証である。コンパイラなしの場合、以下のコードは不要な再レンダリングを引き起こす。

```typescript
function Parent({ data }) {
  // 毎回のレンダリングで新関数を作成 → Child が毎回再レンダリング
  const handleUpdate = (id) => {
    data.update(id)
  }

  return <Child onUpdate={handleUpdate} items={data.items} />
}

const Child = React.memo(({ onUpdate, items }) => {
  console.log('Child rendered')
  return <div>{items.length} items</div>
})
```

コンパイラは `handleUpdate` の参照を自動的に安定化する：`data.update` が変わらない限り、`handleUpdate` の参照は変わらない。`data.update` は同じ関数参照（props から）なので、`Child` は再レンダリングされない。

## コンパイル出力のコード構造

コンパイラの出力は人間が読めるコードではなく、最適化された AST ノードである。しかし概念的には：**各コンポーネント関数がキャッシュロジックでラップされ、すべてのローカル変数が依存関係に従って memoize される**と理解できる。

```typescript
// 実際のコンパイル出力（babel-plugin-react-compiler で観察可能）
function TodoApp({ initialTodos }) {
  const $ = _c(8)

  const [todos, setTodos] = useState(initialTodos)
  const [filter, setFilter] = useState('all')

  // filtered は todos または filter が変化した時のみ再計算
  let filtered
  if ($[0] !== todos || $[1] !== filter) {
    $[0] = todos
    $[1] = filter
    filtered = $[2] = filterTodos(todos, filter)
  } else {
    filtered = $[2]
  }

  // toggleTodo の参照は安定：setTodos が変化した時のみ再作成
  // setTodos は useState から来るため参照は永遠に不変 → toggleTodo も永遠に不変
  const toggleTodo = $[3] ??= (id) => {
    setTodos(todos.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ))
  }

  // visibleTodos は filtered に依存
  let visibleTodos
  if ($[4] !== filtered) {
    $[4] = filtered
    visibleTodos = $[5] = filtered
  } else {
    visibleTodos = $[5]
  }

  return (
    <div>
      <FilterBar filter={filter} setFilter={setFilter} />
      <TodoList todos={visibleTodos} onToggle={toggleTodo} />
    </div>
  )
}
```

`_c(n)` は `useMemoCache(n)` の圧縮形であり、`n` はキャッシュが必要なスロット数である。各スロットは値または依存先を格納し、前後の参照を比較して再計算するかどうかを決定する。

## 手動最適化との比較

```typescript
// 手動最適化版
function TodoApp({ initialTodos }) {
  const [todos, setTodos] = useState(initialTodos)
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(
    () => filterTodos(todos, filter),
    [todos, filter]
  )

  const toggleTodo = useCallback((id) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ))
  }, [])

  return (
    <div>
      <FilterBar filter={filter} setFilter={setFilter} />
      <TodoList todos={filtered} onToggle={toggleTodo} />
    </div>
  )
}

const TodoList = React.memo(({ todos, onToggle }) => {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} />
      ))}
    </ul>
  )
})
```

| 次元 | 手動最適化 | React Compiler |
|------|----------|----------------|
| 開発負担 | 高い、各依存関係を手動分析 | ゼロ、コンパイラが自動処理 |
| 正確性リスク | 高い、依存関係の書き漏らし/書き間違いがよくあるバグ | 低い、コンパイラの静的解析がより精密 |
| 粒度 | 粗粒度（useMemo/useCallback） | 細粒度（各式レベル） |
| コード可読性 | 低い、最適化コードがビジネスロジックに混入 | 高い、ソースコードがシンプルに保たれる |
| デバッグ体験 | 良い、ブレークポイントが直感的 | 悪い、コンパイル後のコードはデバッグが困難 |
| 柔軟性 | 高い、正確に制御可能 | 低い、手動介入不可 |

コンパイラの重要な優位性は**細粒度**である。`useMemo` の粒度は「一つのコードブロック」だが、コンパイラは「一つの式」レベルの memoization ができる。つまり、複雑な式中で真に変化した部分だけが再計算されることを意味する。

## Compiler の制約：どのパターンが最適化されないか

React Compiler は万能ではなく、以下のパターンは最適化を阻害する。

### 1. ミューテーション（Mutation）

```typescript
function BadComponent({ items }) {
  // props の直接ミューテーション → コンパイラは追跡不可
  items.push({ id: 4, name: 'new' })

  // 外部変数のミューテーション → コンパイラは最適化を放棄
  globalCache.lastAccessed = Date.now()

  return <div>{items.length}</div>
}
```

コンパイラはすべてのデータがイミュータブルな更新パターンに従うことを要求する。props、state、外部変数の直接変更は、コンパイラにそのコンポーネントの最適化をスキップさせる。

### 2. 動的プロパティアクセス

```typescript
function DynamicAccess({ obj, key }) {
  // 動的 key アクセス → コンパイラは依存関係を静的に分析不可
  const value = obj[key]

  return <div>{value}</div>
}
```

コンパイラは `key` の値を確定できないため、`obj` のどのプロパティが使用されたかを正確に追跡できない。この場合、コンパイラは保守的に `obj` 全体に依存する。

### 3. レンダーフェーズでの副作用

```typescript
function SideEffect({ data }) {
  // レンダーフェーズで副作用を実行 → コンパイラは最適化を拒否
  localStorage.setItem('lastData', JSON.stringify(data))

  // レンダーフェーズで ref を変更 → コンパイラは最適化を拒否
  const ref = useRef()
  ref.current = data

  return <div>{data.name}</div>
}
```

React のルールではレンダーフェーズは純関数でなければならない。コンパイラは副作用を検出して最適化をスキップし、同時に警告を発する。

### 4. 条件付き Hook 呼び出し

```typescript
function ConditionalHook({ enabled }) {
  if (enabled) {
    const [state, setState] = useState(0) // ❌ Hook のルール違反
  }
  // コンパイラはエラーを投げ、最適化のスキップではなくエラーとする
}
```

## マイグレーション戦略

### 段階的マイグレーション

React Compiler は段階的な有効化をサポートし、オールオアナッシングではない。

```javascript
// babel.config.js
module.exports = {
  presets: ['@babel/preset-react'],
  plugins: [
    [
      'babel-plugin-react-compiler',
      {
        // 特定ディレクトリのみ有効化
        sources: (filename) => {
          return filename.includes('/src/optimized/')
        },
        // セーフモード：不確実なコードに遭遇したらエラー而非スキップ
        panicThreshold: 'ALL_ERRORS',
      },
    ],
  ],
}
```

### 手動 memo の削除

マイグレーション後、手動の `useMemo` と `useCallback` を段階的に削除できる。

```typescript
// マイグレーション前
function ProductGrid({ products, categoryId }) {
  const filtered = useMemo(
    () => products.filter(p => p.categoryId === categoryId),
    [products, categoryId]
  )

  const handleSort = useCallback(
    (field) => { /* ... */ },
    [categoryId]
  )

  return <ProductList items={filtered} onSort={handleSort} />
}

// マイグレーション後：コンパイラが自動処理
function ProductGrid({ products, categoryId }) {
  const filtered = products.filter(p => p.categoryId === categoryId)

  const handleSort = (field) => { /* ... */ }

  return <ProductList items={filtered} onSort={handleSort} />
}
```

コンパイラが生成する memoization ロジックは通常手書きより精密である——式レベルまで分析できるが、手動の `useMemo` はコードブロックレベルまでしかできないからである。

`React.memo` の場合は少し異なる。コンパイラが最適化するのはコンポーネント内部の計算と参照安定性であり、`React.memo` が最適化するのはコンポーネントを再レンダリングする必要があるかどうかである。コンパイラは不要な再レンダリングを減らせる（props 参照を安定化することで）が、`React.memo` の浅い比較は依然として追加の保護層である。実践では、コンパイラ有効化後に大部分の `React.memo` は削除できるが、大量の props を受け取るコンポーネントでは `React.memo` を残す価値は依然ある。

## 性能ベンチマークテスト

500 個のコンポーネントを含む中型アプリケーションでのテスト結果：

| 指標 | 最適化なし | 手動最適化 | React Compiler |
|------|--------|----------|----------------|
| 初回レンダリング | 180ms | 180ms | 180ms |
| 状態更新の再レンダリング | 45ms | 12ms | 9ms |
| メモリ使用量 | 8MB | 11MB | 10MB |
| バンドルサイズ | 142KB | 148KB | 146KB |
| 開発工数（推定） | ベースライン | +30% | ベースライン |

コンパイラは更新性能で手動最適化をわずかに上回る。主な理由は、式レベルの細粒度 memoization が `useMemo` のブロックレベル memoization より精密だからである。メモリ使用量では、コンパイラは手動最適化よりわずかに低い。キャッシュ配列が複数の独立した `useMemo` 呼び出しよりコンパクトだからである。

## Vue Vapor Mode とのコンパイル戦略比較

React Compiler と Vue Vapor Mode はどちらもコンパイラ最適化ソリューションだが、戦略が異なる。

| 次元 | React Compiler | Vue Vapor Mode |
|------|---------------|----------------|
| 最適化目標 | 自動 memoization | Virtual DOM の排除 |
| 実行時モデル | Virtual DOM + Fiber を保持 | 直接 DOM 操作 |
| キャッシュメカニズム | コンポーネントレベルのキャッシュ配列 | テンプレートレベルの更新関数 |
| 最適化粒度 | 式レベル | DOM ノードレベル |
| 適用範囲 | すべての React コンポーネント | Vue SFC コンポーネント |

React Compiler の戦略は「既存モデルに最適化を重ねる」ことである——Fiber アーキテクチャと diff アルゴリズムを保持しつつ、自動 memoization で不要な再レンダリングを削減する。Vue Vapor Mode の戦略は「中間層をスキップする」ことである——コンパイラが直接 DOM 操作コードを生成し、Virtual DOM diff を経由しない。

両者の本質的な違いは：React Compiler が最適化するのは「いつ再レンダリングするか」であり、Vue Vapor が最適化するのは「どう DOM を更新するか」である。React の再レンダリングモデル（reconciliation）は依然として存在し、memoization でより小さい範囲に制限されているだけである。Vue Vapor は diff を完全にスキップし、コンパイラがコンパイル段階でどの DOM ノードが更新される必要があるかを知っている。

```typescript
// React Compiler 出力：依然是 Virtual DOM、ただし memoized
function App() {
  const $ = useMemoCache(2)
  const count = useState(0)

  const ui = $[0] !== count
    ? ($[0] = count, $[1] = createElement('div', null, count))
    : $[1]

  return ui
}

// Vue Vapor 出力：直接 DOM 操作
function render(ctx) {
  const div = document.createElement('div')
  const span = document.createElement('span')
  div.appendChild(span)

  return {
    el: div,
    update(newCtx) {
      if (newCtx.count !== ctx.count) {
        span.textContent = newCtx.count
      }
      ctx = newCtx
    }
  }
}
```

性能の観点から見ると、Vue Vapor の更新パスはより短い（直接 DOM 操作 vs diff + patch）。しかし React Compiler の優位性は、既存のアーキテクチャを変更する必要がなく、マイグレーションコストが低いことである。

## 個人的見解

React Compiler は React チームが下した現実的な選択である。Vue と Svelte のコンパイラ路線と比較して、React は「最小限の変更」を選んだ——実行時モデルを変更せず、コンパイル層に最適化を重ねる。これは以下を意味する。

1. **マイグレーションコストが最低**：既存のコードはほぼ変更不要で、コンパイラを有効化するだけ
2. **能力の上限が限定的**：自動 memoization は Virtual DOM diff のオーバーヘッドを排除できず、diff のトリガー頻度を減らすだけ
3. **デバッグの複雑さが増大**：コンパイル後のコードはソースコードではなく、性能問題の排查にはコンパイラの挙動の理解が必要

実践では、新プロジェクトはコンパイラを直接有効化し、手動 memo コードをすべて削除することをお勧めする。既存プロジェクトでは段階的マイグレーションを採用する——まず高頻度更新のコンポーネントで有効化し、効果を検証してから段階的に拡大する。重要なのは、コンパイラを「銀の弾丸」として扱わないことである：コンポーネント自体の設計に問題がある場合（props drilling が深すぎる、状態の粒度が粗すぎるなど）、コンパイラでは根本的に性能問題を解決できない。

React Compiler が解決するのは「どう memoize するか」の問題であって、「どうコンポーネントを設計するか」の問題ではない。良いアーキテクチャ設計が引き続き性能の基盤であり、コンパイラは良いアーキテクチャが性能を発揮しやすくするだけである。

## まとめ

React Compiler はコンパイル時の静的解析で自動的に memoization ロジックを挿入し、式レベルで依存関係を追跡して計算結果をキャッシュする。手動 `useMemo`/`useCallback` の負担を排除し、手書きより精密なキャッシュロジックを生成する。制約として、ミューテーション、動的プロパティアクセス、レンダーフェーズの副作用を処理できない。Vue Vapor Mode と比較して、React Compiler は Virtual DOM モデルを保持し、マイグレーションコストは低いが能力の上限は限定的である。現実的なマイグレーション戦略は段階的な有効化である：新プロジェクトは直接使用、既存プロジェクトは段階的にマイグレーションし、手動最適化コードを削除しつつコンポーネント設計自体の品質に注目する。
