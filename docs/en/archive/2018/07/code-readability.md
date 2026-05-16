---
title: "Code Readability: Variable Naming and Function Design"
date: 2018-07-24 10:39:04
tags:
  - Frontend
readingTime: 2
description: "Code that you can understand after writing it, that your teammates can understand, and that you can still understand three months later — that's real readabilit"
---

Code that you can understand after writing it, that your teammates can understand, and that you can still understand three months later — that's real readability. Here are some practices for improving code readability.

## Naming: Let Code Speak for Itself

Good naming means code barely needs comments.

### Variable Naming Principles

**Booleans: use is/has/can/should prefixes**

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

**Arrays: use plural or collective nouns**

```javascript
// ❌
const item = [];
const list = [];

// ✅
const users = [];
const selectedIds = [];
const activeOrders = [];
```

**Functions: start with a verb, describe behavior**

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

**Avoid abbreviations (except common ones)**

```javascript
// ❌ Unclear abbreviations
const btn = document.querySelector('.btn')
const element = document.querySelector('.container')
const idx = arr.findIndex(...)
const fn = () => {}

// ✅ Keep common abbreviations (id, url, api, max, min...)
const submitButton = document.querySelector('.submit-btn')
const containerElement = document.querySelector('.container')
const foundIndex = arr.findIndex(...)
const callback = () => {}

// Commonly accepted abbreviations:
// id, url, api, db, http, css, js, el(element), e(event), i(loop index)
```

## Function Design: One Function, One Thing

**Single Responsibility**

```javascript
// ❌ One function doing too much
async function saveAndSendNotification(formData) {
  // validate
  if (!formData.email) throw new Error("Email cannot be empty");
  if (!formData.name) throw new Error("Name cannot be empty");

  // save
  const user = await db.users.create(formData);

  // send email
  await emailService.sendWelcome(user.email);

  // update log
  await auditLog.add({ action: "USER_CREATED", userId: user.id });

  return user;
}

// ✅ Split responsibilities
async function createUser(formData) {
  validateUserForm(formData);
  const user = await db.users.create(formData);
  return user;
}

function validateUserForm(formData) {
  if (!formData.email) throw new Error("Email cannot be empty");
  if (!formData.name) throw new Error("Name cannot be empty");
}

// Caller orchestrates the flow
async function handleRegistration(formData) {
  const user = await createUser(formData);
  await emailService.sendWelcome(user.email);
  await auditLog.add({ action: "USER_CREATED", userId: user.id });
  return user;
}
```

**Avoid Too Many Parameters**

```javascript
// ❌ 5 parameters — caller can't tell which is which
function createButton(text, type, size, disabled, onClick) {}
createButton("Submit", "primary", "large", false, handleSubmit);

// ✅ Use an options object
function createButton({
  text,
  type = "default",
  size = "medium",
  disabled = false,
  onClick,
}) {}
createButton({ text: "Submit", type: "primary", onClick: handleSubmit });
```

## Comments: Write Why, Not What

```javascript
// ❌ Comments repeat what the code says (noise)
users.forEach((user) => {
  if (user.isActive) {
    processUser(user);
  }
});

// ✅ Comments explain why, or non-obvious logic
// Only process users who joined this month; historical users are handled in a separate batch job
users.filter((u) => u.joinedAt >= startOfMonth).forEach(processUser);

// Note: using .9 instead of an integer due to an IE precision bug
// See issue #123
const safeHeight = Math.floor(height * 0.9);
```

## Avoid Magic Numbers

```javascript
// ❌ What is 3? What is 300?
if (list.length > 3) { ... }
setTimeout(refresh, 300)

// ✅ Named constants
const MAX_RECENT_ITEMS = 3
const DEBOUNCE_DELAY = 300  // ms, wait for user to stop typing

if (list.length > MAX_RECENT_ITEMS) { ... }
setTimeout(refresh, DEBOUNCE_DELAY)
```

## Early Return (Guard Clauses)

```javascript
// ❌ Deep nesting
function processOrder(order) {
  if (order) {
    if (order.status === "pending") {
      if (order.items.length > 0) {
        if (order.totalAmount > 0) {
          // main logic here...
        }
      }
    }
  }
}

// ✅ Early return reduces nesting
function processOrder(order) {
  if (!order) return;
  if (order.status !== "pending") return;
  if (order.items.length === 0) return;
  if (order.totalAmount <= 0) return;

  // main logic, no longer nested
```
