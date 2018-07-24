---
title: "代码可读性：变量命名与函数设计"
date: 2018-07-24 10:39:04
tags:
  - 前端
---

代码写完以后，自己能看懂，团队其他人也能看懂，三个月后自己回来还能看懂——这才是真的可读性。整理一些提升代码可读性的实践。

## 命名：让代码自己说话

好的命名让代码几乎不需要注释。

### 变量命名原则

**布尔值：用 is/has/can/should 前缀**

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

**数组：用复数或集合名词**

```javascript
// ❌
const item = [];
const list = [];

// ✅
const users = [];
const selectedIds = [];
const activeOrders = [];
```

**函数：动词开头，描述行为**

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

**避免缩写（常见例外除外）**

```javascript
// ❌ 缩写不清晰
const btn = document.querySelector('.btn')
const element = document.querySelector('.container')
const idx = arr.findIndex(...)
const fn = () => {}

// ✅ 保留常见缩写（id, url, api, max, min...）
const submitButton = document.querySelector('.submit-btn')
const containerElement = document.querySelector('.container')
const foundIndex = arr.findIndex(...)
const callback = () => {}

// 常见可接受缩写
// id, url, api, db, http, css, js, el(element), e(event), i(loop index)
```

## 函数设计：一个函数做一件事

**单一职责**

```javascript
// ❌ 一个函数做了太多事
async function saveAndSendNotification(formData) {
  // 验证
  if (!formData.email) throw new Error("邮箱不能为空");
  if (!formData.name) throw new Error("姓名不能为空");

  // 保存
  const user = await db.users.create(formData);

  // 发送邮件
  await emailService.sendWelcome(user.email);

  // 更新日志
  await auditLog.add({ action: "USER_CREATED", userId: user.id });

  return user;
}

// ✅ 拆分职责
async function createUser(formData) {
  validateUserForm(formData);
  const user = await db.users.create(formData);
  return user;
}

function validateUserForm(formData) {
  if (!formData.email) throw new Error("邮箱不能为空");
  if (!formData.name) throw new Error("姓名不能为空");
}

// 调用者组织流程
async function handleRegistration(formData) {
  const user = await createUser(formData);
  await emailService.sendWelcome(user.email);
  await auditLog.add({ action: "USER_CREATED", userId: user.id });
  return user;
}
```

**参数不要过多**

```javascript
// ❌ 5 个参数，调用时不知道哪个是哪个
function createButton(text, type, size, disabled, onClick) {}
createButton("提交", "primary", "large", false, handleSubmit);

// ✅ 用对象参数
function createButton({
  text,
  type = "default",
  size = "medium",
  disabled = false,
  onClick,
}) {}
createButton({ text: "提交", type: "primary", onClick: handleSubmit });
```

## 注释：写为什么，不写是什么

```javascript
// ❌ 注释重复代码内容（废话）
// 遍历用户列表
users.forEach((user) => {
  // 检查用户是否激活
  if (user.isActive) {
    // 处理激活用户
    processUser(user);
  }
});

// ✅ 注释解释为什么，或者非直觉的逻辑
// 只处理当月加入的用户，历史用户在另一个任务里批量处理
users.filter((u) => u.joinedAt >= startOfMonth).forEach(processUser);

// 注意：这里用 .9 而不是整数，是因为 IE 的精度 bug
// 参见 issue #123
const safeHeight = Math.floor(height * 0.9);
```

## 避免魔法数字

```javascript
// ❌ 3 是什么？300 是什么？
if (list.length > 3) { ... }
setTimeout(refresh, 300)

// ✅ 常量命名
const MAX_RECENT_ITEMS = 3
const DEBOUNCE_DELAY = 300  // ms，等待用户停止输入

if (list.length > MAX_RECENT_ITEMS) { ... }
setTimeout(refresh, DEBOUNCE_DELAY)
```

## 提前返回（Guard Clauses）

```javascript
// ❌ 深度嵌套
function processOrder(order) {
  if (order) {
    if (order.status === "pending") {
      if (order.items.length > 0) {
        if (order.totalAmount > 0) {
          // 主要逻辑在这里...
        }
      }
    }
  }
}

// ✅ 提前返回，减少嵌套
function processOrder(order) {
  if (!order) return;
  if (order.status !== "pending") return;
  if (order.items.length === 0) return;
  if (order.totalAmount <= 0) return;

  // 主要逻辑，不再嵌套
  doProcess(order);
}
```

## 小结

- 命名是最重要的可读性投资，花时间想好名字
- 函数保持单一职责，超过 20 行考虑拆分
- 参数超过 3 个用对象代替
- 注释写为什么，不写是什么
- 魔法数字提取为常量
- 用提前返回减少嵌套层级
