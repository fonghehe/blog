---
title: "浏览器存储方案对比 2018：Cookie、localStorage、IndexedDB"
date: 2018-03-01 11:16:33
tags:
  - 前端
readingTime: 2
description: "前端能用的存储方案有好几种，但什么场景用什么，很多人没有系统梳理过。"
wordCount: 414
---

前端能用的存储方案有好几种，但什么场景用什么，很多人没有系统梳理过。

## 四种存储方式

| 特性       | Cookie     | localStorage | sessionStorage | IndexedDB  |
| 
---------- | ---------- | ------------ | -------------- | ---------- |
| 大小限制   | 4KB        | 5MB          | 5MB            | 无实际限制 |
| 生命周期   | 可设置过期 | 永久         | 标签页关闭删除 | 永久       |
| 随请求发送 | 是         | 否           | 否             | 否         |
| 同步/异步  | 同步       | 同步         | 同步           | 异步       |
| 支持类型   | 字符串     | 字符串       | 字符串         | 任意类型   |

## Cookie

主要用途：服务端读取（身份认证）。前端存数据不应该首选 Cookie。

```javascript
// 读写
document.cookie =
  "username=Alice; expires=Thu, 31 Dec 2018 23:59:59 GMT; path=/";
const cookies = document.cookie; // 'username=Alice; token=xxx'

// Cookie 很难直接用，通常封装成工具函数
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
```

**安全属性：**

- `HttpOnly`：JS 无法读取，防 XSS 窃取 token
- `Secure`：只通过 HTTPS 发送
- `SameSite=Strict`：防 CSRF

## localStorage

最常用的前端存储，用于持久化用户偏好、缓存数据：

```javascript
// 存储（只支持字符串，对象需要序列化）
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));

// 读取
const user = JSON.parse(localStorage.getItem("user"));

// 删除
localStorage.removeItem("user");
localStorage.clear(); // 清空所有

// 遍历所有 key
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
}
```

**封装一个带类型支持的版本：**

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

和 localStorage API 完全一样，区别是标签页关闭后数据消失，且不在标签页之间共享。

适合：表单草稿、多步骤向导的中间状态。

## IndexedDB

真正的客户端数据库，适合大量结构化数据。直接用原生 API 比较繁琐：

```javascript
// 打开数据库
const request = indexedDB.open("myDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  // 创建对象存储（类似表）
  const store = db.createObjectStore("users", { keyPath: "id" });
  store.createIndex("name", "name", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // 写入数据
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").add({ id: 1, name: "Alice", age: 25 });

  // 读取数据
  const readTx = db.transaction("users", "readonly");
  const getRequest = readTx.objectStore("users").get(1);
  getRequest.onsuccess = () => console.log(getRequest.result);
};
```

原生 API 回调嵌套很深，推荐用 `idb` 库封装成 Promise：

```javascript
import { openDB } from "idb";

const db = await openDB("myDB", 1, {
  upgrade(db) {
    db.createObjectStore("users", { keyPath: "id" });
  },
});

// 写入
await db.put("users", { id: 1, name: "Alice" });

// 读取
const user = await db.get("users", 1);
```

## 选择指南

- **需要服务端读取**（如 session token）→ Cookie（配合 HttpOnly）
- **少量用户偏好/配置**（主题、语言）→ localStorage
- **表单临时状态**→ sessionStorage
- **离线缓存大量数据**（文章列表、图片元数据）→ IndexedDB
- **大文件存储**（音视频）→ Cache API（PWA 场景）

## 小结

大多数场景 localStorage 就够用了，记得序列化/反序列化，记得做 try/catch（隐私模式下写 localStorage 会抛异常）。
