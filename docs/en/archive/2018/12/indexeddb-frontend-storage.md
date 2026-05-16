---
title: "IndexedDB: Advanced Frontend Local Storage"
date: 2018-12-19 16:54:08
tags:
  - Frontend
readingTime: 2
description: "`localStorage` can only store strings, has a 5 MB limit, and is awkward to query. IndexedDB is the browser's built-in NoSQL database — it can store hundreds of "
---

`localStorage` can only store strings, has a 5 MB limit, and is awkward to query. IndexedDB is the browser's built-in NoSQL database — it can store hundreds of megabytes, supports transactions and index queries, and is well-suited for offline applications.

## Core Concepts

```
Database
  └── ObjectStore (like a table)
        ├── Record
        └── Index (for queries)
```

## Wrapping a Simple Utility Class

IndexedDB's native API is event-based and verbose. Wrapping it in Promises makes it much nicer to use:

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

## Usage Example

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
  title: "Vue Reactivity Internals",
  category: "vue",
  date: "2018-01-01",
  content: "...",
});

const article = await db.get("articles", "vue-reactivity");
const all = await db.getAll("articles");
```

## Real-World Use Case: Offline Draft Saving

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

// Auto-save while editing (debounced)
editor.on(
  "change",
  debounce(async (content) => {
    await draftManager.saveDraft(content);
  }, 1000),
);
```

## localStorage vs IndexedDB

|              | localStorage   | IndexedDB                           |
| ------------ | -------------- | ----------------------------------- |
| Capacity     | 5 MB           | 250 MB+ (varies by browser)         |
| Data types   | Strings only   | JS objects (binary too)             |
| API          | Synchronous    | Asynchronous                        |
| Querying     | By key only    | Index queries                       |
| Transactions | Not supported  | Supported                           |
| Use cases    | Config, tokens | Offline data, large structured data |

## Summary

- IndexedDB is the browser's built-in NoSQL store; supports large-capacity structured data
- The native event-based API is easier to use once wrapped in Promises
- Good for: offline drafts, caching API data, reducing redundant network requests
- Service Worker + IndexedDB is the key combination for building PWAs
