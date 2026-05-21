---
title: "浏览器存储方案对比：Cookie、localStorage、IndexedDB"
date: 2019-01-31 09:50:31
tags:
  - 前端
readingTime: 2
description: "做前端久了，存储方案没想清楚踩了不少坑。系统梳理一下。"
wordCount: 223
---

做前端久了，存储方案没想清楚踩了不少坑。系统梳理一下。

## 各方案对比

|             | Cookie           | sessionStorage | localStorage | IndexedDB |
| 
----------- | ---------------- | -------------- | ------------ | --------- |
| 容量        | 4KB              | 5-10MB         | 5-10MB       | >250MB    |
| 生命周期    | 设置过期时间     | 标签页关闭     | 永久         | 永久      |
| 服务端访问  | ✅（随请求发送） | ❌             | ❌           | ❌        |
| API         | 字符串操作       | 同步           | 同步         | 异步      |
| 跨 Tab 共享 | ✅               | ❌             | ✅           | ✅        |

## Cookie

```javascript
// 读写 Cookie（原生 API 很难用）
document.cookie = "token=abc123; max-age=86400; path=/; SameSite=Strict";

// 推荐用 js-cookie 库
import Cookies from "js-cookie";

Cookies.set("token", "abc123", { expires: 1 }); // 1天后过期
Cookies.get("token");
Cookies.remove("token");
```

安全属性：

- `HttpOnly`：JS 无法读取（只能后端设置），防 XSS 偷 token
- `Secure`：只在 HTTPS 传输
- `SameSite=Strict/Lax`：防 CSRF

## localStorage

```javascript
// 只能存字符串，对象需要序列化
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));
const user = JSON.parse(localStorage.getItem("user"));
localStorage.removeItem("user");
localStorage.clear();

// 封装一个带过期时间的 storage
class ExpirableStorage {
  set(key, value, ttl) {
    const item = {
      value,
      expiry: ttl ? Date.now() + ttl : null,
    };
    localStorage.setItem(key, JSON.stringify(item));
  }

  get(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    if (item.expiry && Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  }
}
```

## IndexedDB

用于存储大量结构化数据（缓存 API 响应、离线数据等）。

```javascript
// 原生 API 基于事件，比较繁琐，推荐用 idb 库
import { openDB } from "idb";

const db = await openDB("my-app", 1, {
  upgrade(db) {
    const store = db.createObjectStore("cache", { keyPath: "key" });
    store.createIndex("expiry", "expiry");
  },
});

// 写入
await db.put("cache", {
  key: "user-list",
  data: users,
  expiry: Date.now() + 300000,
});

// 读取
const cached = await db.get("cache", "user-list");
if (cached && cached.expiry > Date.now()) {
  return cached.data;
}

// Service Worker 缓存 API 响应（配合使用）
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
```

## 实际项目中的选择

```javascript
// Token 存储：两种流派
// 1. Cookie：HttpOnly，防 XSS
// 2. localStorage：方便，但 XSS 可能泄露

// 推荐：敏感 token 用 HttpOnly Cookie
// 非敏感配置（主题、语言偏好）用 localStorage

// 用户配置
localStorage.setItem("theme", "dark");
localStorage.setItem("locale", "zh-CN");

// API 缓存（考虑用 IndexedDB）
const cache = new Map(); // 内存缓存（刷新丢失）
// 或者用 IndexedDB 持久化缓存

// 表单草稿（防止误刷丢失）
const DRAFT_KEY = `form-draft-${formId}`;
localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
```

## 小结

- Cookie：适合需要服务端读取的数据（token），加 HttpOnly 防 XSS
- localStorage：简单的持久化，注意不要存敏感信息
- sessionStorage：临时数据，标签页关闭自动清除
- IndexedDB：大量结构化数据、离线缓存，用 idb 简化 API
