---
title: "IndexedDB：前端本地存儲進階"
date: 2018-12-19 16:54:08
tags:
  - 前端
readingTime: 2
description: "localStorage 只能存字符串，容量 5MB，查詢不方便。IndexedDB 是瀏覽器內置的 NoSQL 數據庫，容量可達幾百 MB，支持事務和索引查詢，適合離線應用。"
wordCount: 171
---

localStorage 只能存字符串，容量 5MB，查詢不方便。IndexedDB 是瀏覽器內置的 NoSQL 數據庫，容量可達幾百 MB，支持事務和索引查詢，適合離線應用。

## 基本概念

```
Database（數據庫）
  └── ObjectStore（類似表）
        ├── Record（記錄）
        └── Index（索引，用於查詢）
```

## 封裝一個簡單的工具類

IndexedDB 的原生 API 是基於事件的，比較繁瑣，先封裝成 Promise：

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
  title: "Vue 響應式原理",
  category: "vue",
  date: "2018-01-01",
  content: "...",
});

const article = await db.get("articles", "vue-reactivity");
const all = await db.getAll("articles");
```

## 實際場景：離線草稿

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

// 編輯時自動保存（防抖）
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
容量            5MB             250MB+（因瀏覽器而異）
數據類型        只能字符串       JS 對象（二進制也支持）
API             同步            異步
查詢            只能按 key      支持索引查詢
事務            不支持          支持
適用場景        配置、token     離線數據、大量結構化數據
```

## 小結

- IndexedDB 是瀏覽器內置 NoSQL，支持大容量結構化數據
- 原生 API 基於事件，用 Promise 封裝後更好用
- 適合：離線草稿、緩存 API 數據、減少重複網絡請求
- Service Worker + IndexedDB 是構建 PWA 的關鍵組合
