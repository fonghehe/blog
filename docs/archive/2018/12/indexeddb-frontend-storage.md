---
title: "IndexedDB：前端本地存储进阶"
date: 2018-12-19 16:54:08
tags:
  - 前端
readingTime: 2
description: "localStorage 只能存字符串，容量 5MB，查询不方便。IndexedDB 是浏览器内置的 NoSQL 数据库，容量可达几百 MB，支持事务和索引查询，适合离线应用。"
---

localStorage 只能存字符串，容量 5MB，查询不方便。IndexedDB 是浏览器内置的 NoSQL 数据库，容量可达几百 MB，支持事务和索引查询，适合离线应用。

## 基本概念

```
Database（数据库）
  └── ObjectStore（类似表）
        ├── Record（记录）
        └── Index（索引，用于查询）
```

## 封装一个简单的工具类

IndexedDB 的原生 API 是基于事件的，比较繁琐，先封装成 Promise：

```javascript
class IDB {
  constructor(dbName, version, onUpgrade) {
    this.dbName = dbName;
    this.version = version;
    this.onUpgrade = onUpgrade;
    this._db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        this.onUpgrade(e.target.result);
      };

      request.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this);
      };

      request.onerror = () => reject(request.error);
    });
  }

  add(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

## 使用示例

```javascript
const db = await new IDB("myApp", 1, (db) => {
  const store = db.createObjectStore("articles", {
    keyPath: "id",
    autoIncrement: false,
  });
  store.createIndex("category", "category", { unique: false });
  store.createIndex("date", "date", { unique: false });
}).open();

await db.add("articles", {
  id: "vue-reactivity",
  title: "Vue 响应式原理",
  category: "vue",
  date: "2018-01-01",
  content: "...",
});

const article = await db.get("articles", "vue-reactivity");
const all = await db.getAll("articles");
```

## 实际场景：离线草稿

```javascript
class DraftManager {
  async saveDraft(content) {
    await db.put("drafts", {
      id: "current",
      content,
      savedAt: Date.now(),
    });
  }

  async loadDraft() {
    return db.get("drafts", "current");
  }

  async clearDraft() {
    return db.delete("drafts", "current");
  }
}

// 编辑时自动保存（防抖）
editor.on(
  "change",
  debounce(async (content) => {
    await draftManager.saveDraft(content);
  }, 1000),
);
```

## localStorage vs IndexedDB

```
               localStorage    IndexedDB
容量            5MB             250MB+（因浏览器而异）
数据类型        只能字符串       JS 对象（二进制也支持）
API             同步            异步
查询            只能按 key      支持索引查询
事务            不支持          支持
适用场景        配置、token     离线数据、大量结构化数据
```

## 小结

- IndexedDB 是浏览器内置 NoSQL，支持大容量结构化数据
- 原生 API 基于事件，用 Promise 封装后更好用
- 适合：离线草稿、缓存 API 数据、减少重复网络请求
- Service Worker + IndexedDB 是构建 PWA 的关键组合
