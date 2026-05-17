---
title: "IndexedDB：フロントエンドのローカルストレージ上級編"
date: 2018-12-19 16:54:08
tags:
  - フロントエンド
readingTime: 2
description: "localStorage は文字列しか保存できず、容量は 5MB で、クエリも不便です。IndexedDB はブラウザ内蔵の NoSQL データベースで、容量は数百 MB に達し、トランザクションとインデックスクエリをサポートしており、オフラインアプリに適しています。"
---

localStorage は文字列しか保存できず、容量は 5MB で、クエリも不便です。IndexedDB はブラウザ内蔵の NoSQL データベースで、容量は数百 MB に達し、トランザクションとインデックスクエリをサポートしており、オフラインアプリに適しています。

## 基本概念

```
Database（データベース）
  └── ObjectStore（テーブルに相当）
        ├── Record（レコード）
        └── Index（インデックス、クエリに使用）
```

## シンプルなユーティリティクラスの実装

IndexedDB のネイティブ API はイベントベースでやや煩雑なので、Promise にラップします：

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

## 使用例

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
  title: "Vue リアクティブの原理",
  category: "vue",
  date: "2018-01-01",
  content: "...",
});

const article = await db.get("articles", "vue-reactivity");
const all = await db.getAll("articles");
```

## 実際のシナリオ：オフライン下書き

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

// 編集時に自動保存（デバウンス）
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
容量            5MB             250MB+（ブラウザにより異なる）
データ型        文字列のみ       JS オブジェクト（バイナリも対応）
API             同期            非同期
クエリ          キーのみ         インデックスクエリをサポート
トランザクション  非対応          対応
適用場面        設定、トークン   オフラインデータ、大量の構造化データ
```

## まとめ

- IndexedDB はブラウザ内蔵の NoSQL。大容量の構造化データをサポート
- ネイティブ API はイベントベース。Promise でラップすると扱いやすい
- 向いている用途：オフライン下書き、API データのキャッシュ、重複ネットワークリクエストの削減
- Service Worker + IndexedDB は PWA 構築の重要な組み合わせ
