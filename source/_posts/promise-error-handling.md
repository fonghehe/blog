---
title: "Promise 链与错误处理的正确姿势"
date: 2018-02-24 10:00:11
tags:
  - JavaScript
---

Promise 大家都在用，但错误处理经常出问题。整理几个常见的坑和正确做法。

## 基础：then/catch 链

```javascript
fetchUser(userId)
  .then((user) => fetchProfile(user.id))
  .then((profile) => renderProfile(profile))
  .catch((error) => {
    console.error("出错了:", error);
    showError(error.message);
  });
```

链式调用中，任何一步抛出错误，都会跳过后续 `then`，直接到 `catch`。

## 坑 1：忘记 return

```javascript
// ❌ 错误：忘记 return，fetchProfile 的结果丢失
fetchUser(userId)
  .then((user) => {
    fetchProfile(user.id); // 没有 return！
  })
  .then((profile) => {
    console.log(profile); // profile 是 undefined
  });

// ✅ 正确
fetchUser(userId)
  .then((user) => {
    return fetchProfile(user.id); // 或者箭头函数简写: user => fetchProfile(user.id)
  })
  .then((profile) => {
    console.log(profile);
  });
```

## 坑 2：错误在 then 里被吃掉

```javascript
// ❌ 这个 catch 捕获不到 then 里的错误
fetchUser()
  .catch((error) => console.error(error)) // catch 在前面，捕获不到后面的错误
  .then((user) => {
    throw new Error("这里的错误不会被捕获");
  });

// ✅ catch 放在链的末尾
fetchUser()
  .then((user) => {
    throw new Error("这里的错误会被捕获");
  })
  .catch((error) => console.error(error));
```

## 坑 3：异步 catch 里的错误

```javascript
// ❌ catch 里的异步错误不会被捕获
fetchUser().catch((error) => {
  setTimeout(() => {
    throw new Error("定时器里的错误不在 Promise 链里");
  }, 100);
});

// ✅ 返回 Promise 链处理
fetchUser().catch((error) => {
  return someAsyncFallback(); // 返回 Promise
});
```

## then 的第二个参数 vs catch

```javascript
// 方式一：then 的第二个参数（只捕获 fetchUser 的错误）
fetchUser().then(
  (user) => processUser(user),
  (error) => handleFetchError(error), // 只处理 fetchUser 的错误
);

// 方式二：独立 catch（捕获整个链的错误）
fetchUser()
  .then((user) => processUser(user))
  .catch((error) => handleError(error)); // 捕获 fetchUser 和 processUser 的错误
```

大多数情况用 `.catch()` 更清晰。

## Promise.all：并行请求

```javascript
// 同时发起多个请求，全部完成后继续
const [user, settings] = await Promise.all([
  fetchUser(userId),
  fetchSettings(userId),
]);

// 注意：任意一个失败，Promise.all 就 reject
// 需要容错的话，用 Promise.allSettled（ES2020）
const results = await Promise.allSettled([
  fetchUser(userId),
  fetchSettings(userId),
]);

results.forEach((result) => {
  if (result.status === "fulfilled") {
    console.log(result.value);
  } else {
    console.error(result.reason);
  }
});
```

## async/await 的错误处理

async/await 是 Promise 的语法糖，错误处理用 try/catch：

```javascript
async function loadUserPage(userId) {
  try {
    const user = await fetchUser(userId);
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchUser 或 fetchProfile 失败都会到这里
    handleError(error);
  }
}
```

### 更细粒度的错误处理

有时需要对不同步骤的错误分别处理：

```javascript
async function loadUserPage(userId) {
  let user;
  try {
    user = await fetchUser(userId);
  } catch (error) {
    // 只处理 fetchUser 的错误
    redirectToLogin();
    return;
  }

  try {
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchProfile 失败降级处理
    renderPage(user, null); // 没有 profile 也能渲染
  }
}
```

### 实用工具：封装 try/catch

```javascript
// 类似 Go 语言的错误处理风格
async function to(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

// 使用
async function loadData() {
  const [err, user] = await to(fetchUser(userId));
  if (err) {
    handleError(err);
    return;
  }
  console.log(user);
}
```

## 未处理的 Promise 错误

Node.js 和浏览器都会在未处理的 Promise rejection 时给出警告：

```javascript
// 浏览器
window.addEventListener("unhandledrejection", (event) => {
  console.error("未处理的 Promise 错误:", event.reason);
  event.preventDefault(); // 阻止控制台输出（可选）
});

// Node.js
process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 错误:", reason);
});
```

## 小结

- 链式调用里每个 `then` 都要记得 `return`
- `.catch()` 放链的末尾，捕获整个链的错误
- 并行请求用 `Promise.all`，需要容错用 `Promise.allSettled`
- `async/await` 用 `try/catch`，细粒度处理时分开写
- 监听 `unhandledrejection` 防止错误被静默吞掉
