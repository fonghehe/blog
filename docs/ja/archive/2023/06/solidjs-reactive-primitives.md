---
title: "Solid.js：細粒度リアクティビティのもう一つの答え"
date: 2023-06-22 09:48:23
tags:
  - React
readingTime: 4
description: "React には仮想 DOM diff があり、Vue には Proxy リアクティブシステムがあります。Solid は第三の道を選びました。コンパイル時と細粒度シグナルです。このフレームワークはフロントエンドアーキテクトが知る価値があります。"
wordCount: 921
---

React には仮想 DOM diff があり、Vue には Proxy リアクティブシステムがあります。Solid は第三の道を選びました。コンパイル時と細粒度シグナルです。このフレームワークはフロントエンドアーキテクトが知る価値があります。

## コア理念

Solid の設計哲学：**仮想 DOM はありません**。リアクティブシステムは「どの式がどの状態に依存しているか」を追跡し、状態が変化したときに対応する DOM ノードを直接更新します。ツリー全体の差分を取る必要はありません。

```jsx
import { createSignal, createEffect } from "solid-js";

function Counter() {
  const [count, setCount] = createSignal(0);

  // createEffect は count() の依存関係を自動的に追跡する
  createEffect(() => {
    console.log("count:", count());
  });

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      点击了 {count()} 次
    </button>
  );
}
```

`count` は**関数**であり、値ではないことに注意してください。これが Solid と React/Vue の最大の違いです。`count()` を呼び出して初めて値を読み取り、これにより依存関係の追跡が正確になります。

## React との比較

```jsx
// React：状態が変化するたびに、コンポーネント関数全体が再実行される
function Counter() {
  const [count, setCount] = useState(0);
  // この行はレンダリングのたびに実行される
  console.log("rendered");
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Solid：コンポーネント関数は一度だけ実行され、その後は DOM のみが更新される
function Counter() {
  const [count, setCount] = createSignal(0);
  // この行は初期化時に一度だけ実行される
  console.log("created");
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
```

クロージャートラップはなく、`useCallback` や `useMemo` などの最適化フックも必要ありません。コンポーネント関数が再実行されないため、「古いクロージャー参照」の問題は発生しません。

## パフォーマンス特性

```
JS Framework Benchmark（Chrome 118）:

创建 1000 行：
  Solid:    1.20
  Vue 3:    1.48
  Svelte 4: 1.35
  React 18: 1.78
  （越低越好，相对 vanilla JS）

替换 1000 行：
  Solid:    1.25
  React 18: 2.10

部分更新：
  Solid:    1.10
  React 18: 1.95
```

ほとんどのテスト項目で Solid は 1 位またはそれに近い順位です。これはその更新粒度が最も細かいためです。数字を変更すれば、そのテキストノードのみが更新されます。

## リアクティブプリミティブ

```jsx
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  onCleanup,
} from "solid-js";

function UserProfile({ userId }) {
  // 派生状態
  const doubleCount = createMemo(() => count() * 2);

  // 非同期データ取得
  const [user] = createResource(userId, async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  });

  // 副作用 + クリーンアップ
  createEffect(() => {
    const timer = setInterval(() => {
      console.log("tick", count());
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div>
      <Show when={!user.loading} fallback={<div>Loading...</div>}>
        <h1>{user().name}</h1>
      </Show>
    </div>
  );
}
```

`createSignal`、`createMemo`、`createEffect` は React の `useState`、`useMemo`、`useEffect` に相当しますが、セマンティクスがより明確で、依存配列や stale closure の問題がありません。

## 制御フローコンポーネント

```jsx
import { Show, For, Switch, Match } from "solid-js";

function UserList({ users, filter }) {
  return (
    <div>
      {/* 条件付きレンダリング */}
      <Show when={users().length > 0} fallback={<p>没有用户</p>}>
        {/* リストレンダリング */}
        <For each={users()}>
          {(user) => (
            <div>
              <span>{user.name}</span>
              {/* ネストされた条件 */}
              <Switch>
                <Match when={user.role === "admin"}>
                  <Badge color="red">管理员</Badge>
                </Match>
                <Match when={user.role === "editor"}>
                  <Badge color="blue">编辑</Badge>
                </Match>
              </Switch>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
```

`For` コンポーネントは正確なリストの差分を実行し、毎回リスト全体を再構築することはありません。

## Solid を検討するタイミング

**適しているケース：**
- パフォーマンスに敏感なインタラクティブUI（リアルタイムデータダッシュボード、オンラインエディタ）
- 更新を細かく制御する必要があるシナリオ
- チームが新しいパラダイムを学ぶ意欲がある

**適さないケース：**
- 豊富なサードパーティ製コンポーネントライブラリが必要
- 大規模チームでのコラボレーション（エコシステムとツールチェーンは発展途上）
- React エコシステムに大きく依存するプロジェクト

## まとめ

- Solid の細粒度リアクティブは、現在最もパフォーマンスの高いフロントエンドフレームワークの一つです
- 仮想 DOM diff はなく、更新は直接実 DOM を操作します
- `createSignal` シグナルシステムにより、React のクロージャートラップや stale reference 問題を回避します
- エコシステムは成長中ですがまだ十分ではなく、パフォーマンスが重要なシナリオに適しています
- アーキテクトの知識として価値があり、本番で直接使用しなくても知っておく価値があります
