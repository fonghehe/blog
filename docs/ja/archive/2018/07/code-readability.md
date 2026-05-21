---
title: "コードの可読性：変数命名と関数設計"
date: 2018-07-24 10:39:04
tags:
  - フロントエンド
readingTime: 2
description: "書いた後に自分が読めて、チームメンバーも読めて、3ヶ月後に自分が戻ってきても読める——それが本当の可読性です。可読性を高める実践をまとめます。"
wordCount: 242
---

書いた後に自分が読めて、チームメンバーも読めて、3ヶ月後に自分が戻ってきても読める——それが本当の可読性です。可読性を高める実践をまとめます。

## 命名：コード自身に語らせる

良い命名はコメントをほとんど不要にします。

### 変数命名の原則

**ブール値：is/has/can/shouldプレフィックスを使う**

```javascript
// ❌
let login = true;
let admin = false;
let data = true;

// ✅
let isLoggedIn = true;
let isAdmin = false;
let hasData = true;
let canEdit = false;
let shouldRefresh = true;
```

**配列：複数形または集合名詞を使う**

```javascript
// ❌
const item = [];
const list = [];

// ✅
const users = [];
const selectedIds = [];
const activeOrders = [];
```

**関数：動詞で始めて行動を表現する**

```javascript
// ❌
function user(id) { ... }
function data() { ... }

// ✅
function fetchUser(id) { ... }
function getUserList() { ... }
function validateForm(form) { ... }
function handleSubmit(event) { ... }
```

**略語を避ける（一般的なものは例外）**

```javascript
// ❌ 不明確な略語
const btn = document.querySelector('.btn')
const element = document.querySelector('.container')
const idx = arr.findIndex(...)
const fn = () => {}

// ✅ よく知られた略語を残す（id, url, api, max, min...）
const submitButton = document.querySelector('.submit-btn')
const containerElement = document.querySelector('.container')
const foundIndex = arr.findIndex(...)
const callback = () => {}

// 一般的に許容される略語：
// id, url, api, db, http, css, js, el(element), e(event), i(ループインデックス)
```

## 関数設計：1つの関数は1つのことをする

**単一責任**

```javascript
// ❌ 1つの関数がやりすぎ
async function saveAndSendNotification(formData) {
  // バリデーション
  if (!formData.email) throw new Error("メールアドレスは必須です");
  if (!formData.name) throw new Error("名前は必須です");

  // 保存
  const user = await db.users.create(formData);

  // メール送信
  await emailService.sendWelcome(user.email);

  // ログ更新
  await auditLog.add({ action: "USER_CREATED", userId: user.id });

  return user;
}

// ✅ 責任を分割する
async function createUser(formData) {
  validateUserForm(formData);
  const user = await db.users.create(formData);
  return user;
}

function validateUserForm(formData) {
  if (!formData.email) throw new Error("メールアドレスは必須です");
  if (!formData.name) throw new Error("名前は必須です");
}

// 呼び出し側がフローを管理
async function handleRegistration(formData) {
  const user = await createUser(formData);
  await emailService.sendWelcome(user.email);
  await auditLog.add({ action: "USER_CREATED", userId: user.id });
  return user;
}
```

**引数が多すぎないようにする**

```javascript
// ❌ 5つの引数——呼び出し時にどれが何かわからない
function createButton(text, type, size, disabled, onClick) {}
createButton("送信", "primary", "large", false, handleSubmit);

// ✅ オブジェクト引数を使う
function createButton({
  text,
  type = "default",
  size = "medium",
  disabled = false,
  onClick,
}) {}
createButton({ text: "送信", type: "primary", onClick: handleSubmit });
```

## コメント：何をではなく、なぜを書く

```javascript
// ❌ コードの内容を繰り返すコメント（無意味）
users.forEach((user) => {
  if (user.isActive) {
    processUser(user);
  }
});

// ✅ なぜか、または非直感的なロジックを説明するコメント
// 今月入会したユーザーのみを処理。過去のユーザーは別のバッチジョブで一括処理
users.filter((u) => u.joinedAt >= startOfMonth).forEach(processUser);

// 注意：整数ではなく.9を使うのはIEの精度バグのため
// issue #123参照
const safeHeight = Math.floor(height * 0.9);
```

## マジックナンバーを避ける

```javascript
// ❌ 3は何？300は何？
if (list.length > 3) { ... }
setTimeout(refresh, 300)

// ✅ 定数に名前をつける
const MAX_RECENT_ITEMS = 3
const DEBOUNCE_DELAY = 300  // ms、ユーザーの入力停止を待つ

if (list.length > MAX_RECENT_ITEMS) { ... }
setTimeout(refresh, DEBOUNCE_DELAY)
```

## 早期リターン（ガード節）

```javascript
// ❌ 深いネスト
function processOrder(order) {
  if (order) {
    if (order.status === "pending") {
      if (order.items.length > 0) {
        if (order.totalAmount > 0) {
          // メインロジックはここ...
        }
      }
    }
  }
}

// ✅ 早期リターンでネストを減らす
function processOrder(order) {
  if (!order) return;
  if (order.status !== "pending") return;
  if (order.items.length === 0) return;
  if (order.totalAmount <= 0) return;

  // メインロジック。もうネストしない
```
