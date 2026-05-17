---
title: "React Query：フロントエンドのデータ取得とキャッシュを再考する"
date: 2020-07-28 11:08:27
tags:
  - React
readingTime: 2
description: "React Query（现已更名为 TanStack Query）解决的核心问题是：**服务端状态的管理**。Redux、MobX 擅长管理客户端状态，但对于\"从服务器获取数据、缓存、同步\"这类需求，它们提供的工具过于底层。React Query 把这个痛点做成了开箱即用的解决方案。"
---

React Query（现已更名为 TanStack Query）解决的核心问题是：**服务端状态的管理**。Redux、MobX 擅长管理客户端状态，但对于"从服务器获取数据、缓存、同步"这类需求，它们提供的工具过于底层。React Query 把这个痛点做成了开箱即用的解决方案。

## インストールと基本的な使い方

```bash
npm install react-query
```

```jsx
import { QueryClient, QueryClientProvider, useQuery } from "react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserList />
    </QueryClientProvider>
  );
}

function UserList() {
  const { data, isLoading, error } = useQuery(
    "users", // 唯一的 query key
    () => fetch("/api/users").then((r) => r.json()),
  );

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>出错了：{error.message}</div>;

  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## なぜ useEffect + useState を使わないのか

传统写法每次都要手写加载、错误、数据三个状态：

```jsx
// ❌ 传统写法，样板代码多
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);
  // ...
}
```

React Query 提供的不只是更简洁的写法，还有：

- **自动缓存**：相同 key 的数据只请求一次
- **后台刷新**：窗口重新聚焦时自动重新请求
- **去重**：多个组件请求同一数据时只发一次请求
- **自动 GC**：未使用的缓存自动清除

## キャッシュと staleTime

```jsx
// staleTime: 数据多久内视为"新鲜"（不重新请求）
const { data } = useQuery("users", fetchUsers, {
  staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  cacheTime: 10 * 60 * 1000, // 缓存保留 10 分钟（即使没有订阅者）
});
```

## データ変更：useMutation

```jsx
import { useMutation, useQueryClient } from "react-query";

function CreateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (newUser) =>
      fetch("/api/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      }).then((r) => r.json()),
    {
      // 创建成功后，让 'users' 缓存失效，触发重新请求
      onSuccess: () => {
        queryClient.invalidateQueries("users");
      },
    },
  );

  return (
    <button
      onClick={() => mutation.mutate({ name: "Alice" })}
      disabled={mutation.isLoading}
    >
      {mutation.isLoading ? "创建中..." : "创建用户"}
    </button>
  );
}
```

## ページネーションクエリ

```jsx
const [page, setPage] = useState(1);

const { data, isPreviousData } = useQuery(
  ["users", page],
  () => fetchUsers(page),
  {
    keepPreviousData: true, // 翻页时保留上一页数据，避免加载闪烁
  },
);
```

## まとめ

React Query 的核心思想是：**区分客户端状态和服务端状态**，并为服务端状态提供专门的工具。引入它之后，大部分 Redux store 里的异步 action 可以直接删掉，代码量通常减少 30-40%。2020 年的 React 项目非常值得引入。
