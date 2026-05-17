---
title: "useEffect完全ガイド：依存配列という落とし穴"
date: 2019-03-10 10:47:44
tags:
  - フロントエンド
readingTime: 1
description: "React Hooksを1ヶ月使って気づいたのは、`useEffect`が最も落とし穴にはまりやすい場所だということだ。特に依存配列は、原理を理解していないとバグを生む。"
---

React Hooksを1ヶ月使って気づいたのは、`useEffect`が最も落とし穴にはまりやすい場所だということだ。特に依存配列は、原理を理解していないとバグを生む。

## 原理から始める

`useEffect`の本質は「同期」——副作用をReactのレンダリングと同期させること。

```javascript
// 心智模型：
// 每次渲染后，React 检查依赖是否变化
// 如果变化了，先运行上次的清理函数，再运行新的 effect

function MyComponent({ id }) {
  useEffect(() => {
    console.log("effect 运行，id =", id);
    return () => {
      console.log("清理，id =", id); // 上次的 id
    };
  }, [id]);
}

// 渲染 id=1 → effect 运行（id=1）
// 渲染 id=2 → 清理（id=1）→ effect 运行（id=2）
// 卸载    → 清理（id=2）
```

## よくある間違い1：依存関係の漏れ

```javascript
// ❌ 错的：遗漏了 userId 依赖
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // [] 表示只运行一次，但 userId 变化时不会重新获取！

  return <div>{user?.name}</div>;
}

// ✅ 对的：声明所有依赖
useEffect(() => {
  fetchUser(userId).then(setUser);
}, [userId]); // userId 变化时重新获取
```

`eslint-plugin-react-hooks`をインストールすると、`exhaustive-deps`ルールが依存関係の漏れを自動的に警告してくれる。

## よくある間違い2：無限ループ

```javascript
// ❌ 在 effect 里修改了依赖的状态
function ProblematicComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    processData(data); // 读取 data
    setData([...data, newItem]); // 修改 data
  }, [data]); // data 变了 → 重新运行 → data 又变了 → 无限循环！
}

// ✅ 用 ref 或函数式更新
function FixedComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + 1); // 函数式更新，不需要依赖 count
    }, 1000);
    return () => clearInterval(timer);
  }, []); // [] 合法，因为不再依赖 count
}
```

## useCallbackとuseMemo

effectが関数に依存する場合、問題が起きやすい：

```javascript
// ❌ 每次渲染都创建新的 fetchUser 函数引用
function Parent({ userId }) {
  const fetchUser = () => fetch(`/api/user/${userId}`); // 每次新建

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // 每次都执行！
}

// ✅ useCallback 缓存函数引用
function Parent({ userId }) {
  const fetchUser = useCallback(() => {
    return fetch(`/api/user/${userId}`);
  }, [userId]); // 只有 userId 变化才创建新函数

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // fetchUser 稳定，不会无限执行
}
```

```javascript
// useMemo：缓存计算结果（避免每次渲染重算）
function ProductList({ products, category }) {
  // 只有 products 或 category 变化时才重新过滤
  const filtered = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category],
  );

  return (
    <ul>
      {filtered.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
```
