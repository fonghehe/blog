---
title: "React Hooks 登場：useState と useEffect の初体験"
date: 2018-09-12 17:05:13
tags:
  - React
readingTime: 4
description: "先月 React チームが Hooks の RFC を提案し、昨日試してみました。これは React エコシステムで最大の変化の一つだと感じています。"
wordCount: 774
---

先月 React チームが Hooks の RFC を提案し、昨日試してみました。これは React エコシステムで最大の変化の一つだと感じています。

> **注意**：React Hooks は現在（2018年9月）RFC 段階であり、API はまだ変わる可能性があります。React 16.7 alpha で体験できる予定です。

## Hooks が解決する問題

Hooks 以前には、長期にわたる痛点がいくつかありました：

1. **ロジックの再利用が難しい**：複数コンポーネント間でステートフルなロジックを共有するには HOC や render props が必要で、ネストが深くなる
2. **複雑なコンポーネントが理解しにくい**：ライフサイクルに関連するロジックが分散している（例：サブスクライブと解除が componentDidMount と componentWillUnmount に分かれている）
3. **class の this が混乱を招く**：初学者がよく this のバインドを忘れる

Hooks によって関数コンポーネントでもステートと副作用が持てるようになります。

## useState：ステート Hook

```javascript
import React, { useState } from "react";

// 以前：class が必要
class Counter extends React.Component {
  state = { count: 0 };

  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        Count: {this.state.count}
      </button>
    );
  }
}

// Hooks：関数コンポーネントでもステートを持てる
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

`useState` は `[現在の値, 更新関数]` の配列を返します。分割代入で受け取ります。

```javascript
// 複数のステート
function UserForm() {
  const [name, setName] = useState("");
  const [age, setAge] = useState(0);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await saveUser({ name, age });
    setLoading(false);
  }

  return (
    <form onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={age} onChange={(e) => setAge(Number(e.target.value))} />
      <button disabled={loading}>{loading ? "保存中..." : "保存"}</button>
    </form>
  );
}
```

## useEffect：副作用 Hook

```javascript
import React, { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useEffect はレンダー後に実行。componentDidMount + componentDidUpdate に相当
  useEffect(() => {
    setLoading(true);

    fetchUser(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });

    // 返す関数は次の effect 実行前またはコンポーネントのアンマウント時に呼ばれる
    // componentWillUnmount に相当
    return () => {
      // クリーンアップ：リクエストのキャンセル、サブスクリプションの解除など
    };
  }, [userId]); // 依存配列：userId が変わった時だけ再実行

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

**依存配列のルール：**

```javascript
useEffect(() => {
  // 毎レンダー後に実行
});

useEffect(() => {
  // マウント時に1回だけ実行（componentDidMount に相当）
}, []);

useEffect(() => {
  // userId または type が変わった時に実行
}, [userId, type]);
```

## カスタム Hook：ロジックの再利用

これが Hooks の最も強力な点です。ステートフルなロジックを再利用可能な関数として抽出できます：

```javascript
// カスタム Hook：データ取得ロジックをカプセル化
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}

// 複数のコンポーネントで再利用
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);
  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}

function UserAvatar({ userId }) {
  const { user } = useUser(userId);
  return <img src={user?.avatar} alt={user?.name} />;
}
```

HOC のネストや render props より断然わかりやすい！

## Vue 3 Composition API との比較

Vue 3 も同様の Composition API を検討していると聞いています。Hooks と多くの設計思想が似ています。どちらも：

- 関連するロジックをライフサイクルに分散させず一箇所にまとめる
- ロジックの再利用をネストなしでサポートする

```javascript
// Vue 3 Composition API（プレビュー、2018年時点ではまだない）
export default {
  setup() {
    const count = ref(0);
    const increment = () => count.value++;

    onMounted(() => {
      console.log("mounted");
    });

    return { count, increment };
  },
};
```

## 現在の状況

React Hooks は現在 RFC 段階で、React コアチームがコミュニティのフィードバックを求めています。興味があれば：

- RFC: https://github.com/reactjs/rfcs
- Dan Abramov の紹介記事と動画は見る価値あり

年末か来年に安定版がリリースされる見込みです。個人的にはこの方向は正しいと思います。HOC/render props より断然エレガントです。

## まとめ

- `useState` で関数コンポーネントにステートを持たせる
- `useEffect` で副作用（データ取得、サブスクリプション、DOM 操作）を処理する
- カスタム Hook でステートフルなロジックを関数のように再利用できる
- 現在はまだ RFC 段階。正式リリース前に API が変わる可能性あり
