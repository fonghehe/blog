---
title: "ES2017 async/await ベストプラクティス"
date: 2018-01-13 09:34:55
tags:
  - JavaScript
readingTime: 2
description: "async/await は ES2017 で正式に標準化されました。Node.js 7.6+ はネイティブでサポートしており、Babel を使えばフロントエンドプロジェクトでも利用できます。半年以上の実際の使用経験をまとめました。"
wordCount: 404
---

async/await は ES2017 で正式に標準化されました。Node.js 7.6+ はネイティブでサポートしており、Babel を使えばフロントエンドプロジェクトでも利用できます。半年以上の実際の使用経験をまとめました。

## 基礎レビュー

```javascript
// Promise チェーン
function fetchUserData(userId) {
  return fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then((user) => fetch(`/api/orders?userId=${user.id}`))
    .then((res) => res.json())
    .catch((err) => console.error(err));
}

// async/await への書き換え
async function fetchUserData(userId) {
  const userRes = await fetch(`/api/users/${userId}`);
  const user = await userRes.json();
  const ordersRes = await fetch(`/api/orders?userId=${user.id}`);
  const orders = await ordersRes.json();
  return { user, orders };
}
```

async/await は Promise のシンタックスシュガーですが、可読性が大幅に向上します。特に多段ネストの非同期ロジックで効果的です。

## エラーハンドリング：try/catch の乱用を避ける

最も一般的なアンチパターンは、すべての await を個別の try/catch で囲むことです：

```javascript
// アンチパターン：ノイズが多い
async function loadPage() {
  try {
    const user = await getUser();
  } catch (e) {
    console.error(e);
  }

  try {
    const posts = await getPosts();
  } catch (e) {
    console.error(e);
  }
}
```

ビジネス要件に応じてエラー処理の粒度を決める方が良いです：

```javascript
// 方法1：統一処理、どこかで失敗したら中断
async function loadPage() {
  try {
    const user = await getUser();
    const posts = await getPosts(user.id);
    return { user, posts };
  } catch (err) {
    handleError(err);
  }
}

// 方法2：to() ヘルパー関数（Go言語スタイル）
const to = (promise) =>
  promise.then((data) => [null, data]).catch((err) => [err, null]);

async function loadPage() {
  const [userErr, user] = await to(getUser());
  if (userErr) {
    return renderGuestPage();
  }

  const [postsErr, posts] = await to(getPosts(user.id));
  if (postsErr) {
    return renderPage(user, []);
  }

  return renderPage(user, posts);
}
```

## 並列リクエスト：await を直列化しない

これは最も一般的なパフォーマンスの落とし穴です：

```javascript
// 遅い：直列実行、合計時間 = A + B
async function loadDashboard() {
  const users = await fetchUsers(); // 200ms 待機
  const orders = await fetchOrders(); // さらに 300ms 待機
  // 合計: 500ms
}

// 速い：並列実行、合計時間 = max(A, B)
async function loadDashboard() {
  const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()]);
  // 合計: 300ms
}
```

後のリクエストが前のリクエストの結果に依存する場合のみ直列化が必要です。それ以外は `Promise.all` を優先しましょう。

## ループ内の async/await

```javascript
const userIds = [1, 2, 3, 4, 5];

// 間違い：forEach は async コールバックを待たない
userIds.forEach(async (id) => {
  await processUser(id); // forEach はここを待たない
});

// 直列処理：一つずつ（順序が必要な場合）
for (const id of userIds) {
  await processUser(id);
}

// 並列処理：全て同時に発行（依存関係がない場合）
await Promise.all(userIds.map((id) => processUser(id)));

// 同時実行数を制限したバッチ処理
async function processInBatches(items, batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processItem(item)));
  }
}
```

## Vue/React コンポーネントでの使用

```javascript
// Vue コンポーネント
export default {
  data() {
    return {
      loading: false,
      error: null,
      posts: [],
    };
  },
  async created() {
    this.loading = true;
    try {
      this.posts = await fetchPosts();
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  },
};
```

```javascript
// React コンポーネント
class PostList extends React.Component {
  state = { loading: false, posts: [], error: null };

  async componentDidMount() {
    this.setState({ loading: true });
    try {
      const posts = await fetchPosts();
      this.setState({ posts, loading: false });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  }
}
```

注意：非同期処理が完了する前にコンポーネントがアンマウントされる可能性があります。「アンマウント後に setState しない」問題は別途対処が必要です。

## Babel 設定

ブラウザで async/await を使用するには：

```bash
npm install --save-dev @babel/preset-env
```

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "useBuiltIns": "usage",
        "corejs": 3
      }
    ]
  ]
}
```
