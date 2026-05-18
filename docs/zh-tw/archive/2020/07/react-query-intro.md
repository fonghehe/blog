---
title: "React Query：重新思考前端資料請求與快取"
date: 2020-07-28 11:08:27
tags:
  - React
readingTime: 2
description: "React Query（現已更名為 TanStack Query）解決的核心問題是：**服務端狀態的管理**。Redux、MobX 擅長管理客戶端狀態，但對於\"從伺服器獲取資料、快取、同步\"這類需求，它們提供的工具過於底層。React Query 把這個痛點做成了開箱即用的解決方案。"
---

React Query（現已更名為 TanStack Query）解決的核心問題是：**服務端狀態的管理**。Redux、MobX 擅長管理客戶端狀態，但對於"從伺服器獲取資料、快取、同步"這類需求，它們提供的工具過於底層。React Query 把這個痛點做成了開箱即用的解決方案。

## 安裝和基礎用法

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

  if (isLoading) return <div>載入中...</div>;
  if (error) return <div>出錯了：{error.message}</div>;

  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## 為什麼不用 useEffect + useState

傳統寫法每次都要手寫載入、錯誤、資料三個狀態：

```jsx
// ❌ 傳統寫法，樣板程式碼多
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

React Query 提供的不只是更簡潔的寫法，還有：

- **自動快取**：相同 key 的資料只請求一次
- **後臺重新整理**：視窗重新聚焦時自動重新請求
- **去重**：多個元件請求同一資料時只發一次請求
- **自動 GC**：未使用的快取自動清除

## 快取與 staleTime

```jsx
// staleTime: 資料多久內視為"新鮮"（不重新請求）
const { data } = useQuery("users", fetchUsers, {
  staleTime: 5 * 60 * 1000, // 5 分鐘內不重新請求
  cacheTime: 10 * 60 * 1000, // 快取保留 10 分鐘（即使沒有訂閱者）
});
```

## 資料修改：useMutation

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
      // 建立成功後，讓 'users' 快取失效，觸發重新請求
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
      {mutation.isLoading ? "建立中..." : "建立使用者"}
    </button>
  );
}
```

## 分頁查詢

```jsx
const [page, setPage] = useState(1);

const { data, isPreviousData } = useQuery(
  ["users", page],
  () => fetchUsers(page),
  {
    keepPreviousData: true, // 翻頁時保留上一頁資料，避免載入閃爍
  },
);
```

## 總結

React Query 的核心思想是：**區分客戶端狀態和服務端狀態**，併為服務端狀態提供專門的工具。引入它之後，大部分 Redux store 裡的非同步 action 可以直接刪掉，程式碼量通常減少 30-40%。2020 年的 React 專案非常值得引入。
