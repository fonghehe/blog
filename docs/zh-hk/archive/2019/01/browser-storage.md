---
title: "瀏覽器儲存方案對比 2019：Cookie、localStorage、IndexedDB"
date: 2019-01-31 09:50:31
tags:
  - 前端
readingTime: 2
description: "做前端久了，存儲方案沒想清楚踩了不少坑。系統梳理一下。"
wordCount: 223
---

做前端久了，存儲方案沒想清楚踩了不少坑。系統梳理一下。

## 各方案對比

|             | Cookie           | sessionStorage | localStorage | IndexedDB |
| 
----------- | ---------------- | -------------- | ------------ | --------- |
| 容量        | 4KB              | 5-10MB         | 5-10MB       | >250MB    |
| 生命週期    | 設置過期時間     | 標籤頁關閉     | 永久         | 永久      |
| 服務端訪問  | ✅（隨請求發送） | ❌             | ❌           | ❌        |
| API         | 字符串操作       | 同步           | 同步         | 異步      |
| 跨 Tab 共享 | ✅               | ❌             | ✅           | ✅        |

## Cookie

```javascript
// 讀寫 Cookie（原生 API 很難用）
document.cookie = "token=abc123; max-age=86400; path=/; SameSite=Strict";

// 推薦用 js-cookie 庫
import Cookies from "js-cookie";

Cookies.set("token", "abc123", { expires: 1 }); // 1天後過期
Cookies.get("token");
Cookies.remove("token");
```

安全屬性：

- `HttpOnly`：JS 無法讀取（隻能後端設置），防 XSS 偷 token
- `Secure`：隻在 HTTPS 傳輸
- `SameSite=Strict/Lax`：防 CSRF

## localStorage

```javascript
// 隻能存字符串，對象需要序列化
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));
const user = JSON.parse(localStorage.getItem("user"));
localStorage.removeItem("user");
localStorage.clear();

// 封裝一個帶過期時間的 storage
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

用於存儲大量結構化數據（緩存 API 響應、離線數據等）。

```javascript
// 原生 API 基於事件，比較繁瑣，推薦用 idb 庫
import { openDB } from "idb";

const db = await openDB("my-app", 1, {
  upgrade(db) {
    const store = db.createObjectStore("cache", { keyPath: "key" });
    store.createIndex("expiry", "expiry");
  },
});

// 寫入
await db.put("cache", {
  key: "user-list",
  data: users,
  expiry: Date.now() + 300000,
});

// 讀取
const cached = await db.get("cache", "user-list");
if (cached && cached.expiry > Date.now()) {
  return cached.data;
}

// Service Worker 緩存 API 響應（配合使用）
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
```

## 實際項目中的選擇

```javascript
// Token 存儲：兩種流派
// 1. Cookie：HttpOnly，防 XSS
// 2. localStorage：方便，但 XSS 可能泄露

// 推薦：敏感 token 用 HttpOnly Cookie
// 非敏感配置（主題、語言偏好）用 localStorage

// 用户配置
localStorage.setItem("theme", "dark");
localStorage.setItem("locale", "zh-CN");

// API 緩存（考慮用 IndexedDB）
const cache = new Map(); // 內存緩存（刷新丟失）
// 或者用 IndexedDB 持久化緩存

// 表單草稿（防止誤刷丟失）
const DRAFT_KEY = `form-draft-${formId}`;
localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
```

## 小結

- Cookie：適合需要服務端讀取的數據（token），加 HttpOnly 防 XSS
- localStorage：簡單的持久化，注意不要存敏感信息
- sessionStorage：臨時數據，標籤頁關閉自動清除
- IndexedDB：大量結構化數據、離線緩存，用 idb 簡化 API
