---
title: "JavaScript 错误处理最佳实践"
date: 2018-12-08 11:24:51
tags:
  - JavaScript
readingTime: 2
description: "项目上线后出 bug，最痛苦的不是有 bug，而是不知道 bug 在哪。良好的错误处理让问题更容易定位。"
wordCount: 155
---

项目上线后出 bug，最痛苦的不是有 bug，而是不知道 bug 在哪。良好的错误处理让问题更容易定位。

## 同步错误：try/catch

```javascript
// 基础用法
try {
  JSON.parse("invalid json");
} catch (e) {
  console.error("JSON 解析失败:", e.message);
}

// finally：不管成功还是失败都会执行
function readFile() {
  let file = null;
  try {
    file = openFile("data.json");
    return parseContent(file);
  } catch (e) {
    console.error("读取失败:", e);
    throw e; // 重新抛出，让调用者知道失败了
  } finally {
    if (file) file.close(); // 确保资源被释放
  }
}
```

## 异步错误处理

```javascript
// Promise：用 .catch() 捕获
fetchUser(id)
  .then((user) => renderUser(user))
  .catch((e) => {
    console.error("获取用户失败:", e);
    showErrorMessage("加载失败，请重试");
  });

// async/await：用 try/catch
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    return user;
  } catch (e) {
    if (e.status === 404) {
      return null; // 用户不存在，返回 null 而不是抛出
    }
    throw e; // 其他错误，继续向上传播
  }
}
```

## 自定义错误类

```javascript
// 区分不同类型的错误
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
    throw new ValidationError("邮箱不能为空", "email");
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

// 调用方可以精确处理不同类型的错误
try {
  await createUser({ name: "张三" });
} catch (e) {
  if (e instanceof ValidationError) {
    formErrors[e.field] = e.message; // 显示字段错误
  } else if (e instanceof ApiError) {
    message.error(e.message); // 显示 API 错误
  } else {
    message.error("未知错误，请刷新页面");
    Sentry.captureException(e); // 上报未知错误
  }
}
```

## 全局错误捕获

```javascript
// 捕获未处理的 Promise 拒绝
window.addEventListener("unhandledrejection", (event) => {
  console.error("未处理的 Promise 拒绝:", event.reason);
  Sentry.captureException(event.reason);
  event.preventDefault(); // 阻止默认的控制台警告
});

// 捕获同步错误（运行时错误）
window.addEventListener("error", (event) => {
  if (event.error) {
    Sentry.captureException(event.error);
  }
});
```

## Vue 的错误处理

```javascript
// main.js
Vue.config.errorHandler = (err, vm, info) => {
  // 组件内的错误都会被这里捕获（生产环境）
  console.error("Vue 组件错误:", err, info);
  Sentry.captureException(err, {
    extra: { componentInfo: info },
  });
};

// 组件内：errorCaptured 钩子
export default {
  errorCaptured(err, vm, info) {
    // 捕获子组件的错误
    this.error = err.message;
    return false; // 阻止错误继续向上传播
  },
};
```

## 错误边界组件

```javascript
// 包裹容易出错的区域，出错后降级显示
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
        h("p", "加载失败"),
        h(
          "button",
          {
            on: {
              click: () => {
                this.error = null;
              },
            },
          },
          "重试",
        ),
      ]);
    }
    return this.$slots.default[0];
  },
});
```

## 小结

- 根据错误类型做不同处理，不要一律 `console.error` 就完了
- 自定义错误类让调用方可以精确处理不同情况
- `unhandledrejection` 捕获漏掉 `.catch()` 的 Promise
- Vue `errorHandler` 捕获组件树内的所有错误
- 生产环境接入 Sentry 或类似工具，让错误可见
