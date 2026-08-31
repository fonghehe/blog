---
title: "React Query: Rethinking Frontend Data Fetching and Caching"
date: 2020-07-28 11:08:27
tags:
  - React
readingTime: 2
description: "React Query (now TanStack Query) targets one core problem: server-state management. Redux and MobX handle client state well, but for fetching, caching, and syncing server data their tooling is too low-level. React Query packages that pain into an out-of-the-box solution."
wordCount: 192
---

The core problem React Query (now renamed TanStack Query) solves is **managing server state**. Redux and MobX excel at client state, but for needs like "fetching data from the server, caching, and syncing," the tools they offer are too low-level. React Query turns that pain point into an out-of-the-box solution.

## Installation and Basic Usage

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

## Why Not useEffect + useState

The traditional approach makes you hand-write three states — loading, error, and data — every time:

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

What React Query provides goes beyond more concise code — it also offers:

- **Automatic caching**: data with the same key is requested only once.
- **Background refetch**: automatically re-requests when the window regains focus.
- **Deduplication**: when multiple components request the same data, only one request is sent.
- **Automatic GC**: unused cache is cleared automatically.

## Caching and staleTime

```jsx
// staleTime: 数据多久内视为"新鲜"（不重新请求）
const { data } = useQuery("users", fetchUsers, {
  staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  cacheTime: 10 * 60 * 1000, // 缓存保留 10 分钟（即使没有订阅者）
});
```

## Data Mutation: useMutation

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

## Paginated Queries

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

## Summary

The core idea of React Query is to **separate client state from server state** and provide dedicated tooling for server state. Once you adopt it, most of the async actions in your Redux store can be deleted outright, typically cutting 30–40% of the code. For a React project in 2020, it is well worth introducing.
