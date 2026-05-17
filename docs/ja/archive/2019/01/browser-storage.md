---
title: "ブラウザストレージ比較：Cookie、localStorage、IndexedDB"
date: 2019-01-31 09:50:31
tags:
  - フロントエンド
readingTime: 1
description: "フロントエンド開発を長くやっていると、ストレージの選択を誤って多くの落とし穴にはまった経験がある。ここで体系的にまとめる。"
---

フロントエンド開発を長くやっていると、ストレージの選択を誤って多くの落とし穴にはまった経験がある。ここで体系的にまとめる。

## 各方式の比較

|                  | Cookie                 | sessionStorage | localStorage | IndexedDB |
| ---------------- | ---------------------- | -------------- | ------------ | --------- |
| 容量             | 4KB                    | 5-10MB         | 5-10MB       | >250MB    |
| ライフタイム     | 有効期限設定           | タブを閉じる   | 永続         | 永続      |
| サーバーアクセス | ✅（リクエストに付随） | ❌             | ❌           | ❌        |
| API              | 文字列操作             | 同期           | 同期         | 非同期    |
| タブ間共有       | ✅                     | ❌             | ✅           | ✅        |

## Cookie

```javascript
// Cookieの読み書き（ネイティブAPIは使いにくい）
document.cookie = "token=abc123; max-age=86400; path=/; SameSite=Strict";

// 推奨：js-cookieライブラリを使う
import Cookies from "js-cookie";

Cookies.set("token", "abc123", { expires: 1 }); // 1日後に期限切れ
Cookies.get("token");
Cookies.remove("token");
```

セキュリティ属性：

- `HttpOnly`：JSから読み取れない（バックエンドのみ設定可能）、XSSによるトークン盗取を防ぐ
- `Secure`：HTTPSでのみ送信
- `SameSite=Strict/Lax`：CSRFを防ぐ

## localStorage

```javascript
// 文字列のみ保存可能；オブジェクトはシリアライズが必要
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));
const user = JSON.parse(localStorage.getItem("user"));
localStorage.removeItem("user");
localStorage.clear();

// 有効期限付きストレージラッパー
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

大量の構造化データ（APIレスポンスのキャッシュ、オフラインデータなど）の保存に使用する。

```javascript
// ネイティブAPIはイベントベースで冗長；idbライブラリを推奨
import { openDB } from "idb";

const db = await openDB("my-app", 1, {
  upgrade(db) {
    const store = db.createObjectStore("cache", { keyPath: "key" });
    store.createIndex("expiry", "expiry");
  },
});

// 書き込み
await db.put("cache", {
  key: "user-list",
  data: users,
  expiry: Date.now() + 300000,
});

// 読み込み
const cached = await db.get("cache", "user-list");
if (cached && cached.expiry > Date.now()) {
  return cached.data;
}
```
