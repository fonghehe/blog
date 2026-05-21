---
title: "useEffect 完全指南：依赖数组是个坑"
date: 2019-03-10 10:47:44
tags:
  - 前端
readingTime: 2
description: "React Hooks 用了一个月，发现 `useEffect` 是最容易踩坑的地方。尤其是依赖数组，不理解原理就会写出 bug。"
wordCount: 196
---

React Hooks 用了一个月，发现 `useEffect` 是最容易踩坑的地方。尤其是依赖数组，不理解原理就会写出 bug。

## 从原理开始

`useEffect` 本质是"同步"——让副作用与 React 渲染同步。

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

## 常见错误 1：遗漏依赖

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

安装 `eslint-plugin-react-hooks` 后，`exhaustive-deps` 规则会自动提示遗漏的依赖。

## 常见错误 2：无限循环

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

## useCallback 和 useMemo

当 effect 依赖函数时，容易出现问题：

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
    </ul>
  );
}
```

## 竞态条件（Race Condition）

```javascript
// ❌ 如果快速切换 userId，可能后发的请求先返回
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser); // 竞态！
  }, [userId]);
}

// ✅ 用 cleanup 函数取消过期请求
useEffect(() => {
  let cancelled = false;

  fetchUser(userId).then((user) => {
    if (!cancelled) setUser(user); // 只有当前 effect 还有效才更新
  });

  return () => {
    cancelled = true;
  };
}, [userId]);

// 或者用 AbortController
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${userId}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => {
      if (e.name !== "AbortError") throw e;
    });

  return () => controller.abort();
}, [userId]);
```

## 小结

- 依赖数组要诚实：用到的变量都要声明（用 eslint 检查）
- 函数式更新 `setState(prev => ...)` 可以减少对 state 的依赖
- `useCallback`/`useMemo` 稳定函数/对象引用，避免不必要的 effect 触发
- 异步 effect 要处理竞态条件，用 cancelled flag 或 AbortController
