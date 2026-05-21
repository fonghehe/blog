---
title: "ES2017 async/await 最佳實踐"
date: 2018-01-13 09:34:55
tags:
  - JavaScript
readingTime: 2
description: "async/await 在 ES2017 正式成為標準，Node.js 7.6+ 原生支援，搭配 Babel 可以在前端專案裡使用。用了半年多，記錄一些實際專案中累積的經驗。"
wordCount: 294
---

async/await 在 ES2017 正式成為標準，Node.js 7.6+ 原生支援，搭配 Babel 可以在前端專案裡使用。用了半年多，記錄一些實際專案中累積的經驗。

## 基礎回顧

```javascript
// Promise 鏈式寫法
function fetchUserData(userId) {
  return fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then((user) => fetch(`/api/orders?userId=${user.id}`))
    .then((res) => res.json())
    .catch((err) => console.error(err));
}

// async/await 改寫
async function fetchUserData(userId) {
  const userRes = await fetch(`/api/users/${userId}`);
  const user = await userRes.json();
  const ordersRes = await fetch(`/api/orders?userId=${user.id}`);
  const orders = await ordersRes.json();
  return { user, orders };
}
```

async/await 本質是 Promise 的語法糖，但可讀性大幅提升，特別是多層巢狀的非同步邏輯。

## 錯誤處理：不要過度使用 try/catch

最常見的反模式是每個 await 都包一個 try/catch：

```javascript
// 反模式：雜訊太多
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

更好的方式是根據業務需要決定錯誤處理粒度：

```javascript
// 方式一：統一處理，任何一步失敗都終止
async function loadPage() {
  try {
    const user = await getUser();
    const posts = await getPosts(user.id);
    return { user, posts };
  } catch (err) {
    // 統一處理：跳轉到錯誤頁或顯示提示
    handleError(err);
  }
}

// 方式二：to 工具函式，類似 Go 的錯誤處理風格
const to = (promise) =>
  promise.then((data) => [null, data]).catch((err) => [err, null]);

async function loadPage() {
  const [userErr, user] = await to(getUser());
  if (userErr) {
    // 使用者資訊取得失敗，可以用預設值繼續
    return renderGuestPage();
  }

  const [postsErr, posts] = await to(getPosts(user.id));
  if (postsErr) {
    // 文章取得失敗，用空陣列降級
    return renderPage(user, []);
  }

  return renderPage(user, posts);
}
```

## 並行請求：不要讓 await 串行

這是最常見的效能陷阱：

```javascript
// 慢：串行執行，總時間 = 請求A時間 + 請求B時間
async function loadDashboard() {
  const users = await fetchUsers(); // 等待 200ms
  const orders = await fetchOrders(); // 再等待 300ms
  // 總共 500ms
}

// 快：並行執行，總時間 = max(請求A時間, 請求B時間)
async function loadDashboard() {
  const [users, orders] = await Promise.all([
    fetchUsers(), // 同時發出
    fetchOrders(), // 同時發出
  ]);
  // 總共 300ms
}
```

只有當後一個請求依賴前一個請求的結果時，才需要串行 await。否則優先考慮 `Promise.all`。

## 迴圈中的 async/await

```javascript
const userIds = [1, 2, 3, 4, 5];

// 錯誤：forEach 不等待 async 回呼
userIds.forEach(async (id) => {
  await processUser(id); // forEach 不會等這裡完成
});

// 串行處理：一個接一個（適合有順序要求的場景）
for (const id of userIds) {
  await processUser(id);
}

// 並行處理：同時發出所有請求（適合無相依的場景）
await Promise.all(userIds.map((id) => processUser(id)));

// 限制並發數（適合批次作業，避免打爆伺服器）
async function processInBatches(items, batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processItem(item)));
  }
}
```

## 在 Vue/React 元件裡使用

```javascript
// Vue 元件
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
// React 元件（在事件處理函式裡，不在 render 裡）
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

注意：元件可能在非同步操作完成前被銷毀，需要處理「元件已卸載後不要 setState」的問題，這是另一個話題了。

## Babel 設定

要在瀏覽器裡使用 async/await，需要：

```bash
npm install --save-dev babel-plugin-transform-async-to-generator babel-polyfill
# 或者用 babel-preset-env 統一處理
npm install --save-dev babel-preset-env
```

```json
// .babelrc
{
  "presets": [
    [
      "env",
      {
        "targets": {
          "browsers": ["> 1%", "last 2 versions"]
        },
        "useBuiltIns": "usage"
      }
    ]
  ]
}
```

`useBuiltIns: "usage"` 只引入實際用到的 polyfill，避免全量引入 babel-polyfill 的體積負擔。

---

_下一篇：PWA 漸進式 Web 應用入門_
