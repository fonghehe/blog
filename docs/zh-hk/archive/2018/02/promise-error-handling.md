---
title: "Promise 鏈與錯誤處理的正確姿勢"
date: 2018-02-24 10:00:11
tags:
  - JavaScript
readingTime: 2
description: "Promise 大家都在用，但錯誤處理經常出問題。整理幾個常見的坑和正確做法。"
---

Promise 大家都在用，但錯誤處理經常出問題。整理幾個常見的坑和正確做法。

## 基礎：then/catch 鏈

```javascript
fetchUser(userId)
  .then((user) => fetchProfile(user.id))
  .then((profile) => renderProfile(profile))
  .catch((error) => {
    console.error("出錯了:", error);
    showError(error.message);
  });
```

鏈式調用中，任何一步拋出錯誤，都會跳過後續 `then`，直接到 `catch`。

## 坑 1：忘記 return

```javascript
// ❌ 錯誤：忘記 return，fetchProfile 的結果丟失
fetchUser(userId)
  .then((user) => {
    fetchProfile(user.id); // 沒有 return！
  })
  .then((profile) => {
    console.log(profile); // profile 是 undefined
  });

// ✅ 正確
fetchUser(userId)
  .then((user) => {
    return fetchProfile(user.id); // 或者箭頭函數簡寫: user => fetchProfile(user.id)
  })
  .then((profile) => {
    console.log(profile);
  });
```

## 坑 2：錯誤在 then 裏被吃掉

```javascript
// ❌ 這個 catch 捕獲不到 then 裏的錯誤
fetchUser()
  .catch((error) => console.error(error)) // catch 在前面，捕獲不到後面的錯誤
  .then((user) => {
    throw new Error("這裏的錯誤不會被捕獲");
  });

// ✅ catch 放在鏈的末尾
fetchUser()
  .then((user) => {
    throw new Error("這裏的錯誤會被捕獲");
  })
  .catch((error) => console.error(error));
```

## 坑 3：異步 catch 裏的錯誤

```javascript
// ❌ catch 裏的異步錯誤不會被捕獲
fetchUser().catch((error) => {
  setTimeout(() => {
    throw new Error("定時器裏的錯誤不在 Promise 鏈裏");
  }, 100);
});

// ✅ 返回 Promise 鏈處理
fetchUser().catch((error) => {
  return someAsyncFallback(); // 返回 Promise
});
```

## then 的第二個參數 vs catch

```javascript
// 方式一：then 的第二個參數（只捕獲 fetchUser 的錯誤）
fetchUser().then(
  (user) => processUser(user),
  (error) => handleFetchError(error), // 只處理 fetchUser 的錯誤
);

// 方式二：獨立 catch（捕獲整個鏈的錯誤）
fetchUser()
  .then((user) => processUser(user))
  .catch((error) => handleError(error)); // 捕獲 fetchUser 和 processUser 的錯誤
```

大多數情況用 `.catch()` 更清晰。

## Promise.all：並行請求

```javascript
// 同時發起多個請求，全部完成後繼續
const [user, settings] = await Promise.all([
  fetchUser(userId),
  fetchSettings(userId),
]);

// 注意：任意一個失敗，Promise.all 就 reject
// 需要容錯的話，用 Promise.allSettled（ES2020）
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

## async/await 的錯誤處理

async/await 是 Promise 的語法糖，錯誤處理用 try/catch：

```javascript
async function loadUserPage(userId) {
  try {
    const user = await fetchUser(userId);
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchUser 或 fetchProfile 失敗都會到這裏
    handleError(error);
  }
}
```

### 更細粒度的錯誤處理

有時需要對不同步驟的錯誤分別處理：

```javascript
async function loadUserPage(userId) {
  let user;
  try {
    user = await fetchUser(userId);
  } catch (error) {
    // 只處理 fetchUser 的錯誤
    redirectToLogin();
    return;
  }

  try {
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchProfile 失敗降級處理
    renderPage(user, null); // 沒有 profile 也能渲染
  }
}
```

### 實用工具：封裝 try/catch

```javascript
// 類似 Go 語言的錯誤處理風格
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

## 未處理的 Promise 錯誤

Node.js 和瀏覽器都會在未處理的 Promise rejection 時給出警告：

```javascript
// 瀏覽器
window.addEventListener("unhandledrejection", (event) => {
  console.error("未處理的 Promise 錯誤:", event.reason);
  event.preventDefault(); // 阻止控制台輸出（可選）
});

// Node.js
process.on("unhandledRejection", (reason, promise) => {
  console.error("未處理的 Promise 錯誤:", reason);
});
```

## 小結

- 鏈式調用裏每個 `then` 都要記得 `return`
- `.catch()` 放鏈的末尾，捕獲整個鏈的錯誤
- 並行請求用 `Promise.all`，需要容錯用 `Promise.allSettled`
- `async/await` 用 `try/catch`，細粒度處理時分開寫
- 監聽 `unhandledrejection` 防止錯誤被靜默吞掉
