---
title: "瀏覽器存儲方案對比：Cookie、localStorage、IndexedDB"
date: 2018-03-01 11:16:33
tags:
  - 前端
readingTime: 2
description: "前端能用的存儲方案有好幾種，但什麼場景用什麼，很多人沒有系統梳理過。"
wordCount: 414
---

前端能用的存儲方案有好幾種，但什麼場景用什麼，很多人沒有系統梳理過。

## 四種存儲方式

| 特性       | Cookie     | localStorage | sessionStorage | IndexedDB  |
| 
---------- | ---------- | ------------ | -------------- | ---------- |
| 大小限制   | 4KB        | 5MB          | 5MB            | 無實際限制 |
| 生命週期   | 可設置過期 | 永久         | 標籤頁關閉刪除 | 永久       |
| 隨請求發送 | 是         | 否           | 否             | 否         |
| 同步/異步  | 同步       | 同步         | 同步           | 異步       |
| 支持類型   | 字符串     | 字符串       | 字符串         | 任意類型   |

## Cookie

主要用途：服務端讀取（身份認證）。前端存數據不應該首選 Cookie。

```javascript
// 讀寫
document.cookie =
  "username=Alice; expires=Thu, 31 Dec 2018 23:59:59 GMT; path=/";
const cookies = document.cookie; // 'username=Alice; token=xxx'

// Cookie 很難直接用，通常封裝成工具函數
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
```

**安全屬性：**

- `HttpOnly`：JS 無法讀取，防 XSS 竊取 token
- `Secure`：只通過 HTTPS 發送
- `SameSite=Strict`：防 CSRF

## localStorage

最常用的前端存儲，用於持久化用户偏好、緩存數據：

```javascript
// 存儲（只支持字符串，對象需要序列化）
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));

// 讀取
const user = JSON.parse(localStorage.getItem("user"));

// 刪除
localStorage.removeItem("user");
localStorage.clear(); // 清空所有

// 遍歷所有 key
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
}
```

**封裝一個帶類型支持的版本：**

```javascript
const storage = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
```

## sessionStorage

和 localStorage API 完全一樣，區別是標籤頁關閉後數據消失，且不在標籤頁之間共享。

適合：表單草稿、多步驟嚮導的中間狀態。

## IndexedDB

真正的客户端數據庫，適合大量結構化數據。直接用原生 API 比較繁瑣：

```javascript
// 打開數據庫
const request = indexedDB.open("myDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  // 創建對象存儲（類似表）
  const store = db.createObjectStore("users", { keyPath: "id" });
  store.createIndex("name", "name", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // 寫入數據
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").add({ id: 1, name: "Alice", age: 25 });

  // 讀取數據
  const readTx = db.transaction("users", "readonly");
  const getRequest = readTx.objectStore("users").get(1);
  getRequest.onsuccess = () => console.log(getRequest.result);
};
```

原生 API 回調嵌套很深，推薦用 `idb` 庫封裝成 Promise：

```javascript
import { openDB } from "idb";

const db = await openDB("myDB", 1, {
  upgrade(db) {
    db.createObjectStore("users", { keyPath: "id" });
  },
});

// 寫入
await db.put("users", { id: 1, name: "Alice" });

// 讀取
const user = await db.get("users", 1);
```

## 選擇指南

- **需要服務端讀取**（如 session token）→ Cookie（配合 HttpOnly）
- **少量用户偏好/配置**（主題、語言）→ localStorage
- **表單臨時狀態**→ sessionStorage
- **離線緩存大量數據**（文章列表、圖片元數據）→ IndexedDB
- **大文件存儲**（音視頻）→ Cache API（PWA 場景）

## 小結

大多數場景 localStorage 就夠用了，記得序列化/反序列化，記得做 try/catch（隱私模式下寫 localStorage 會拋異常）。
