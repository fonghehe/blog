---
title: "React.memo と useCallback によるパフォーマンス最適化——いつ使うべきか"
date: 2019-07-15 10:56:35
tags:
  - React
readingTime: 2
description: "React 16.6 で `React.memo` が導入され、Hooks の `useCallback` と `useMemo` と合わせて、開発者はより多くのパフォーマンス最適化手段を持つようになりました。しかし実際のプロジェクトでは、多くの人が「memo を至る所に追加する」という誤りに陥っています。この記事では"
---

React 16.6 で `React.memo` が導入され、Hooks の `useCallback` と `useMemo` と合わせて、開発者はより多くのパフォーマンス最適化手段を持つようになりました。しかし実際のプロジェクトでは、多くの人が「memo を至る所に追加する」という誤りに陥っています。この記事ではこれらの API の正しい使い方を解説します。

## React.memo の基本

`React.memo` は `PureComponent` に似た高階コンポーネントですが、関数コンポーネント向けです。props を浅く比較し、変化がなければ再レンダリングをスキップします。

```jsx
// memo なし：親がレンダリングするたびに子も再レンダリング
function UserCard({ user }) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// memo あり：props が変わったときだけ再レンダリング
const UserCard = React.memo(function UserCard({ user }) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});
```

## 問題：参照の安定性

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");

  // レンダリングのたびに新しい関数参照が作られる！
  const handleClick = (id) => {
    console.log("clicked", id);
  };

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onClick={handleClick} // 毎回新しい関数！
        />
      ))}
    </div>
  );
}
```

`React.memo` が `UserCard` の再レンダリングを防いでくれると思いますか？防いでくれません。`handleClick` がレンダリングのたびに新しい関数参照になるため、`React.memo` の浅い比較が props の変化を検出して再レンダリングします。

## useCallback で解決

```jsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");

  // 安定した関数参照
  const handleClick = useCallback((id) => {
    console.log("clicked", id);
  }, []); // 空の依存配列：関数は常に同一

  const handleDelete = useCallback((id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []); // setUsers は安定しているので含める必要なし

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {users
        .filter((u) => u.name.includes(filter))
        .map((user) => (
          <UserCard
            key={user.id}
            user={user}
            onClick={handleClick}
            onDelete={handleDelete}
          />
        ))}
    </div>
  );
}
```

## これらのフックを使うべきでない場合

`memo`/`useCallback`/`useMemo` を何でもかんでも使うべきではありません：

1. **シンプルなコンポーネント** — 比較のオーバーヘッドがレンダリングコストを上回ることがある
2. **ほぼ常に再レンダリングするコンポーネント** — memo を使ってもメリットがない
3. **プリミティブな props** — プリミティブは値で比較されるため、安定性の問題はない

## まとめ

- `React.memo` は props が変わらないとき（浅い比較）の再レンダリングをスキップ
- `useCallback` は関数参照を安定化し、`React.memo` と組み合わせて不必要な子のレンダリングを防ぐ
- `useMemo` は高コストな計算結果をキャッシュする
- 最適化の前に React DevTools の Profiler で問題箇所を特定する
