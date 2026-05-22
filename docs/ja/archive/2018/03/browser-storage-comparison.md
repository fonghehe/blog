---
title: "浏览器存储ソリューション对比 2018：Cookie、localStorage、IndexedDB"
date: 2018-03-01 11:16:33
tags:
  - フロントエンド
readingTime: 3
description: "フロントエンドで使えるストレージにはいくつかの種類がありますが、どのシナリオで何を使うかを体系的に整理していない人が多いです。"
wordCount: 691
---

フロントエンドで使えるストレージにはいくつかの種類がありますが、どのシナリオで何を使うかを体系的に整理していない人が多いです。

## 4 種類のストレージ

| 特性                 | Cookie           | localStorage | sessionStorage     | IndexedDB    |
| -------------------- | ---------------- | ------------ | ------------------ | ------------ |
| サイズ制限           | 4KB              | 5MB          | 5MB                | 実質制限なし |
| ライフサイクル       | 有効期限設定可能 | 永続         | タブを閉じると削除 | 永続         |
| リクエストと共に送信 | はい             | いいえ       | いいえ             | いいえ       |
| 同期/非同期          | 同期             | 同期         | 同期               | 非同期       |
| サポートする型       | 文字列           | 文字列       | 文字列             | 任意の型     |

## Cookie

主な用途：サーバー側での読み取り（認証）。フロントエンドのデータ保存には Cookie を第一選択にすべきではありません。

```javascript
// 読み書き
document.cookie =
  "username=Alice; expires=Thu, 31 Dec 2018 23:59:59 GMT; path=/";
const cookies = document.cookie; // 'username=Alice; token=xxx'

// Cookie を直接扱うのは難しいので、通常はユーティリティ関数でラップする
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
```

**セキュリティ属性：**

- `HttpOnly`：JS から読み取れない、XSS による token 窃取を防ぐ
- `Secure`：HTTPS でのみ送信
- `SameSite=Strict`：CSRF を防ぐ

## localStorage

最もよく使われるフロントエンドストレージ。ユーザー設定やキャッシュデータの永続化に使います：

```javascript
// 保存（文字列のみサポート、オブジェクトはシリアライズが必要）
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));

// 読み取り
const user = JSON.parse(localStorage.getItem("user"));

// 削除
localStorage.removeItem("user");
localStorage.clear(); // すべてクリア

// すべてのキーを列挙
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
}
```

**型サポート付きのラッパー：**

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

API は localStorage と完全に同じ。違いはタブを閉じるとデータが消え、タブ間で共有されない点です。

適した用途：フォームの下書き、マルチステップウィザードの中間状態。

## IndexedDB

大量の構造化データ向けの本格的なクライアントデータベース。ネイティブ API は非常に冗長です：

```javascript
// データベースを開く
const request = indexedDB.open("myDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  // オブジェクトストア（テーブルに相当）を作成
  const store = db.createObjectStore("users", { keyPath: "id" });
  store.createIndex("name", "name", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // 書き込み
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").add({ id: 1, name: "Alice", age: 25 });

  // 読み取り
  const readTx = db.transaction("users", "readonly");
  const getRequest = readTx.objectStore("users").get(1);
  getRequest.onsuccess = () => console.log(getRequest.result);
};
```

ネイティブ API はコールバックが深くネストされるので、`idb` ライブラリで Promise 化することをお勧めします：

```javascript
import { openDB } from "idb";

const db = await openDB("myDB", 1, {
  upgrade(db) {
    db.createObjectStore("users", { keyPath: "id" });
  },
});

// 書き込み
await db.put("users", { id: 1, name: "Alice" });

// 読み取り
const user = await db.get("users", 1);
```

## 選び方ガイド

- **サーバーが読み取る必要がある**（セッション token など）→ Cookie（HttpOnly と組み合わせて）
- **少量のユーザー設定/構成**（テーマ、言語）→ localStorage
- **一時的なフォーム状態**→ sessionStorage
- **大量データのオフラインキャッシュ**（記事リスト、画像メタデータ）→ IndexedDB
- **大きなファイルの保存**（音声・動画）→ Cache API（PWA シナリオ）

## まとめ

ほとんどのシナリオでは localStorage で十分です。シリアライズ/デシリアライズを忘れずに、try/catch も追加してください（プライベートブラウジングモードでは localStorage への書き込みが例外をスローします）。
