---
title: "程式碼可讀性：變數命名與函式設計"
date: 2018-07-24 10:39:04
tags:
  - 前端
readingTime: 2
description: "程式碼寫完以後，自己能看懂，團隊其他人也能看懂，三個月後自己回來還能看懂——這才是真的可讀性。整理一些提升程式碼可讀性的實踐。"
wordCount: 260
---

程式碼寫完以後，自己能看懂，團隊其他人也能看懂，三個月後自己回來還能看懂——這才是真的可讀性。整理一些提升程式碼可讀性的實踐。

## 命名：讓程式碼自己說話

好的命名讓程式碼幾乎不需要註釋。

### 變數命名原則

**布林值：用 is/has/can/should 字首**

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

**陣列：用複數或集合名詞**

```javascript
// ❌
const item = [];
const list = [];

// ✅
const users = [];
const selectedIds = [];
const activeOrders = [];
```

**函式：動詞開頭，描述行為**

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

**避免縮寫（常見例外除外）**

```javascript
// ❌ 縮寫不清晰
const btn = document.querySelector('.btn')
const element = document.querySelector('.container')
const idx = arr.findIndex(...)
const fn = () => {}

// ✅ 保留常見縮寫（id, url, api, max, min...）
const submitButton = document.querySelector('.submit-btn')
const containerElement = document.querySelector('.container')
const foundIndex = arr.findIndex(...)
const callback = () => {}

// 常見可接受縮寫
// id, url, api, db, http, css, js, el(element), e(event), i(loop index)
```

## 函式設計：一個函式做一件事

**單一職責**

```javascript
// ❌ 一個函式做了太多事
async function saveAndSendNotification(formData) {
  // 驗證
  if (!formData.email) throw new Error("郵箱不能為空");
  if (!formData.name) throw new Error("姓名不能為空");

  // 儲存
  const user = await db.users.create(formData);

  // 傳送郵件
  await emailService.sendWelcome(user.email);

  // 更新日誌
  await auditLog.add({ action: "USER_CREATED", userId: user.id });

  return user;
}

// ✅ 拆分職責
async function createUser(formData) {
  validateUserForm(formData);
  const user = await db.users.create(formData);
  return user;
}

function validateUserForm(formData) {
  if (!formData.email) throw new Error("郵箱不能為空");
  if (!formData.name) throw new Error("姓名不能為空");
}

// 呼叫者組織流程
async function handleRegistration(formData) {
  const user = await createUser(formData);
  await emailService.sendWelcome(user.email);
  await auditLog.add({ action: "USER_CREATED", userId: user.id });
  return user;
}
```

**引數不要過多**

```javascript
// ❌ 5 個引數，呼叫時不知道哪個是哪個
function createButton(text, type, size, disabled, onClick) {}
createButton("提交", "primary", "large", false, handleSubmit);

// ✅ 用物件引數
function createButton({
  text,
  type = "default",
  size = "medium",
  disabled = false,
  onClick,
}) {}
createButton({ text: "提交", type: "primary", onClick: handleSubmit });
```

## 註釋：寫為什麼，不寫是什麼

```javascript
// ❌ 註釋重複程式碼內容（廢話）
// 遍歷使用者列表
users.forEach((user) => {
  // 檢查使用者是否啟用
  if (user.isActive) {
    // 處理啟用使用者
    processUser(user);
  }
});

// ✅ 註釋解釋為什麼，或者非直覺的邏輯
// 隻處理當月加入的使用者，歷史使用者在另一個任務裡批次處理
users.filter((u) => u.joinedAt >= startOfMonth).forEach(processUser);

// 注意：這裡用 .9 而不是整數，是因為 IE 的精度 bug
// 參見 issue #123
const safeHeight = Math.floor(height * 0.9);
```

## 避免魔法數字

```javascript
// ❌ 3 是什麼？300 是什麼？
if (list.length > 3) { ... }
setTimeout(refresh, 300)

// ✅ 常量命名
const MAX_RECENT_ITEMS = 3
const DEBOUNCE_DELAY = 300  // ms，等待使用者停止輸入

if (list.length > MAX_RECENT_ITEMS) { ... }
setTimeout(refresh, DEBOUNCE_DELAY)
```

## 提前返回（Guard Clauses）

```javascript
// ❌ 深度巢狀
function processOrder(order) {
  if (order) {
    if (order.status === "pending") {
      if (order.items.length > 0) {
        if (order.totalAmount > 0) {
          // 主要邏輯在這裡...
        }
      }
    }
  }
}

// ✅ 提前返回，減少巢狀
function processOrder(order) {
  if (!order) return;
  if (order.status !== "pending") return;
  if (order.items.length === 0) return;
  if (order.totalAmount <= 0) return;

  // 主要邏輯，不再巢狀
  doProcess(order);
}
```

## 小結

- 命名是最重要的可讀性投資，花時間想好名字
- 函式保持單一職責，超過 20 行考慮拆分
- 引數超過 3 個用物件代替
- 註釋寫為什麼，不寫是什麼
- 魔法數字提取為常量
- 用提前返回減少巢狀層級
