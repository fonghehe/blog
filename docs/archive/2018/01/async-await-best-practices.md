---
title: "ES2017 async/await 最佳实践"
date: 2018-01-13 09:34:55
tags:
  - JavaScript
readingTime: 2
description: "async/await 在 ES2017 正式成为标准，Node.js 7.6+ 原生支持，配合 Babel 可以在前端项目里使用。用了半年多，记录一些实际项目中积累的经验。"
---

async/await 在 ES2017 正式成为标准，Node.js 7.6+ 原生支持，配合 Babel 可以在前端项目里使用。用了半年多，记录一些实际项目中积累的经验。

## 基础回顾

```javascript
// Promise 链式写法
function fetchUserData(userId) {
  return fetch(`/api/users/${userId}`)
    .then((res) => res.json())
    .then((user) => fetch(`/api/orders?userId=${user.id}`))
    .then((res) => res.json())
    .catch((err) => console.error(err));
}

// async/await 改写
async function fetchUserData(userId) {
  const userRes = await fetch(`/api/users/${userId}`);
  const user = await userRes.json();
  const ordersRes = await fetch(`/api/orders?userId=${user.id}`);
  const orders = await ordersRes.json();
  return { user, orders };
}
```

async/await 本质是 Promise 的语法糖，但可读性大幅提升，特别是多层嵌套的异步逻辑。

## 错误处理：不要过度使用 try/catch

最常见的反模式是每个 await 都包一个 try/catch：

```javascript
// 反模式：噪音太多
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

更好的方式是根据业务需要决定错误处理粒度：

```javascript
// 方式一：统一处理，任何一步失败都终止
async function loadPage() {
  try {
    const user = await getUser();
    const posts = await getPosts(user.id);
    return { user, posts };
  } catch (err) {
    // 统一处理：跳转到错误页或显示提示
    handleError(err);
  }
}

// 方式二：to 工具函数，类似 Go 的错误处理风格
const to = (promise) =>
  promise.then((data) => [null, data]).catch((err) => [err, null]);

async function loadPage() {
  const [userErr, user] = await to(getUser());
  if (userErr) {
    // 用户信息获取失败，可以用默认值继续
    return renderGuestPage();
  }

  const [postsErr, posts] = await to(getPosts(user.id));
  if (postsErr) {
    // 文章获取失败，用空列表降级
    return renderPage(user, []);
  }

  return renderPage(user, posts);
}
```

## 并行请求：不要让 await 串行

这是最常见的性能陷阱：

```javascript
// 慢：串行执行，总时间 = 请求A时间 + 请求B时间
async function loadDashboard() {
  const users = await fetchUsers(); // 等待 200ms
  const orders = await fetchOrders(); // 再等待 300ms
  // 总共 500ms
}

// 快：并行执行，总时间 = max(请求A时间, 请求B时间)
async function loadDashboard() {
  const [users, orders] = await Promise.all([
    fetchUsers(), // 同时发出
    fetchOrders(), // 同时发出
  ]);
  // 总共 300ms
}
```

只有当后一个请求依赖前一个请求的结果时，才需要串行 await。否则优先考虑 `Promise.all`。

## 循环中的 async/await

```javascript
const userIds = [1, 2, 3, 4, 5];

// 错误：forEach 不等待 async 回调
userIds.forEach(async (id) => {
  await processUser(id); // forEach 不会等这里完成
});

// 串行处理：一个接一个（适合有顺序要求的场景）
for (const id of userIds) {
  await processUser(id);
}

// 并行处理：同时发出所有请求（适合无依赖的场景）
await Promise.all(userIds.map((id) => processUser(id)));

// 限制并发数（适合批量操作，避免打爆服务端）
async function processInBatches(items, batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processItem(item)));
  }
}
```

## 在 Vue/React 组件里使用

```javascript
// Vue 组件
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
// React 组件（在事件处理函数里，不在 render 里）
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

注意：组件可能在异步操作完成前被销毁，需要处理"组件已卸载后不要 setState"的问题，这是另一个话题了。

## Babel 配置

要在浏览器里使用 async/await，需要：

```bash
npm install --save-dev babel-plugin-transform-async-to-generator babel-polyfill
# 或者用 babel-preset-env 统一处理
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

`useBuiltIns: "usage"` 只引入实际用到的 polyfill，避免全量引入 babel-polyfill 的体积负担。

---

_下一篇：PWA 渐进式 Web 应用入门_
