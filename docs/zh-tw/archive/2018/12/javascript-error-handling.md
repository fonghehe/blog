---
title: "JavaScript 錯誤處理最佳實踐"
date: 2018-12-08 11:24:51
tags:
  - JavaScript
readingTime: 2
description: "專案上線後出 bug，最痛苦的不是有 bug，而是不知道 bug 在哪。良好的錯誤處理讓問題更容易定位。"
wordCount: 157
---

專案上線後出 bug，最痛苦的不是有 bug，而是不知道 bug 在哪。良好的錯誤處理讓問題更容易定位。

## 同步錯誤：try/catch

```javascript
// 基礎用法
try {
  JSON.parse("invalid json");
} catch (e) {
  console.error("JSON 解析失敗:", e.message);
}

// finally：不管成功還是失敗都會執行
function readFile() {
  let file = null;
  try {
    file = openFile("data.json");
    return parseContent(file);
  } catch (e) {
    console.error("讀取失敗:", e);
    throw e; // 重新丟擲，讓呼叫者知道失敗了
  } finally {
    if (file) file.close(); // 確保資源被釋放
  }
}
```

## 非同步錯誤處理

```javascript
// Promise：用 .catch() 捕獲
fetchUser(id)
  .then((user) => renderUser(user))
  .catch((e) => {
    console.error("獲取使用者失敗:", e);
    showErrorMessage("載入失敗，請重試");
  });

// async/await：用 try/catch
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    return user;
  } catch (e) {
    if (e.status === 404) {
      return null; // 使用者不存在，返回 null 而不是丟擲
    }
    throw e; // 其他錯誤，繼續向上傳播
  }
}
```

## 自定義錯誤類

```javascript
// 區分不同型別的錯誤
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

// 使用
async function createUser(data) {
  if (!data.email) {
    throw new ValidationError("郵箱不能為空", "email");
  }

  const res = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(body.message, res.status, body.code);
  }

  return res.json();
}

// 呼叫方可以精確處理不同型別的錯誤
try {
  await createUser({ name: "張三" });
} catch (e) {
  if (e instanceof ValidationError) {
    formErrors[e.field] = e.message; // 顯示欄位錯誤
  } else if (e instanceof ApiError) {
    message.error(e.message); // 顯示 API 錯誤
  } else {
    message.error("未知錯誤，請重新整理頁面");
    Sentry.captureException(e); // 上報未知錯誤
  }
}
```

## 全域性錯誤捕獲

```javascript
// 捕獲未處理的 Promise 拒絕
window.addEventListener("unhandledrejection", (event) => {
  console.error("未處理的 Promise 拒絕:", event.reason);
  Sentry.captureException(event.reason);
  event.preventDefault(); // 阻止預設的控製臺警告
});

// 捕獲同步錯誤（執行時錯誤）
window.addEventListener("error", (event) => {
  if (event.error) {
    Sentry.captureException(event.error);
  }
});
```

## Vue 的錯誤處理

```javascript
// main.js
Vue.config.errorHandler = (err, vm, info) => {
  // 元件內的錯誤都會被這裡捕獲（生產環境）
  console.error("Vue 元件錯誤:", err, info);
  Sentry.captureException(err, {
    extra: { componentInfo: info },
  });
};

// 元件內：errorCaptured 鉤子
export default {
  errorCaptured(err, vm, info) {
    // 捕獲子元件的錯誤
    this.error = err.message;
    return false; // 阻止錯誤繼續向上傳播
  },
};
```

## 錯誤邊界元件

```javascript
// 包裹容易出錯的區域，出錯後降級顯示
Vue.component("ErrorBoundary", {
  data() {
    return { error: null };
  },
  errorCaptured(err) {
    this.error = err;
    return false;
  },
  render(h) {
    if (this.error) {
      return h("div", { class: "error-fallback" }, [
        h("p", "載入失敗"),
        h(
          "button",
          {
            on: {
              click: () => {
                this.error = null;
              },
            },
          },
          "重試",
        ),
      ]);
    }
    return this.$slots.default[0];
  },
});
```

## 小結

- 根據錯誤型別做不同處理，不要一律 `console.error` 就完了
- 自定義錯誤類讓呼叫方可以精確處理不同情況
- `unhandledrejection` 捕獲漏掉 `.catch()` 的 Promise
- Vue `errorHandler` 捕獲元件樹內的所有錯誤
- 生產環境接入 Sentry 或類似工具，讓錯誤可見
