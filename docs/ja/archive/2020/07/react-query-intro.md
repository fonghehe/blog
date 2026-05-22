---
title: "React Query：フロントエンドのデータ取得とキャッシュを再考する"
date: 2020-07-28 11:08:27
tags:
  - React
readingTime: 2
description: "React Query（現在は TanStack Query に名称変更）が解決する核心的な問題は、サーバー状態の管理です。Redux や MobX はクライアント状態の管理に優れていますが、サーバーからのデータ取得、キャッシュ、同期といった要件に対しては、提供するツールが低レベルすぎます。React Query はこの課題を、すぐに使えるソリューションとして実現しました。"
wordCount: 510
---

React Query（現在は TanStack Query に名称変更）が解決する核心的な問題は、**サーバー状態の管理**です。Redux や MobX はクライアント状態の管理に優れていますが、「サーバーからデータを取得、キャッシュ、同期する」といった要件に対して、それらが提供するツールは低レベルすぎます。React Query はこの課題を、すぐに使えるソリューションとして実現しました。

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
    "users", // 一意のクエリキー
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

従来の書き方では、毎回ローディング、エラー、データの3つの状態を手動で記述する必要がありました：

```jsx
// ❌ 従来の書き方、ボイラープレートコードが多い
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

React Query が提供するのは、よりシンプルな書き方だけではありません：

- **自動キャッシュ**：同じキーのデータは1回のみリクエスト
- **バックグラウンドリフレッシュ**：ウィンドウが再フォーカスされると自動的に再リクエスト
- **重複排除**：複数のコンポーネントが同じデータをリクエストする場合、1回のみリクエスト
- **自動 GC**：未使用のキャッシュは自動的に削除

## キャッシュと staleTime

```jsx
// staleTime: データをどれだけ「新鮮」とみなすか（再リクエストしない）
const { data } = useQuery("users", fetchUsers, {
  staleTime: 5 * 60 * 1000, // 5分間は再リクエストしない
  cacheTime: 10 * 60 * 1000, // キャッシュを10分間保持（購読者がいなくても）
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
      // 作成成功後、'users' キャッシュを無効にして再リクエストをトリガー
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
    keepPreviousData: true, // ページ移動時に前のページデータを保持し、ローディングのちらつきを防止
  },
);
```

## まとめ

React Query の核となる考え方は、**クライアント状態とサーバー状態を区別**し、サーバー状態に特化したツールを提供することです。導入後は、ほとんどの Redux store 内の非同期 action を直接削除でき、コード量は通常 30〜40% 削減されます。2020 年の React プロジェクトには非常に導入する価値があります。
