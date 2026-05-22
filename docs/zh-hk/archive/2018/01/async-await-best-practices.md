---
title: "ES2017 async/await 最佳實踐：落地路徑與實戰建議"
date: 2018-01-13 09:34:55
tags:
  - JavaScript
readingTime: 2
description: "async/await 喺 ES2017 正式成為標準，Node.js 7.6+ 原生支援，配合 Babel 可以喺前端項目裡面使用。用咗半年幾，記錄一啲實際項目入面累積嘅經驗。"
wordCount: 301
---

async/await 喺 ES2017 正式成為標準，Node.js 7.6+ 原生支援，配合 Babel 可以喺前端項目裡面使用。用咗半年幾，記錄一啲實際項目入面累積嘅經驗。

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

async/await 本質係 Promise 嘅語法糖，但可讀性大幅提升，特別係多層巢狀嘅非同步邏輯。

## 錯誤處理：唔好過度使用 try/catch

最常見嘅反模式係每個 await 都包一個 try/catch：

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

更好嘅方式係根據業務需要決定錯誤處理粒度：

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

// 方式二：to 工具函數，類似 Go 嘅錯誤處理風格
const to = (promise) =>
  promise.then((data) => [null, data]).catch((err) => [err, null]);

async function loadPage() {
  const [userErr, user] = await to(getUser());
  if (userErr) {
    // 用戶資料獲取失敗，可以用預設值繼續
    return renderGuestPage();
  }

  const [postsErr, posts] = await to(getPosts(user.id));
  if (postsErr) {
    // 文章獲取失敗，用空列表降級
    return renderPage(user, []);
  }

  return renderPage(user, posts);
}
```

## 並行請求：唔好讓 await 串行

呢個係最常見嘅效能陷阱：

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

隻有當後一個請求依賴前一個請求嘅結果時，先需要串行 await。否則優先考慮 `Promise.all`。

## 循環中嘅 async/await

```javascript
const userIds = [1, 2, 3, 4, 5];

// 錯誤：forEach 唔等待 async 回調
userIds.forEach(async (id) => {
  await processUser(id); // forEach 唔會等呢度完成
});

// 串行處理：一個接一個（適合有順序要求嘅場景）
for (const id of userIds) {
  await processUser(id);
}

// 並行處理：同時發出所有請求（適合無依賴嘅場景）
await Promise.all(userIds.map((id) => processUser(id)));

// 限製並發數（適合批量操作，避免打爆伺服器）
async function processInBatches(items, batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processItem(item)));
  }
}
```

## 喺 Vue/React 組件裡面使用

```javascript
// Vue 組件
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
// React 組件（喺事件處理函數裡面，唔係喺 render 裡面）
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

注意：組件可能喺非同步操作完成前已經被銷毀，需要處理「組件已卸載後唔好 setState」嘅問題，呢個係另一個話題。

## Babel 設定

要喺瀏覽器裡面使用 async/await，需要：

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

`useBuiltIns: "usage"` 隻引入實際用到嘅 polyfill，避免全量引入 babel-polyfill 嘅體積負擔。

---

_下一篇：PWA 漸進式 Web 應用入門_
