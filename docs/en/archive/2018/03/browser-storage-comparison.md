---
title: "Browser Storage Comparison: Cookie, localStorage, and IndexedDB"
date: 2018-03-01 11:16:33
tags:
  - Frontend
readingTime: 2
description: "Frontend has several storage options, but many people haven't systematically thought about which to use for which scenario."
---

Frontend has several storage options, but many people haven't systematically thought about which to use for which scenario.

## Four Storage Options

| Feature         | Cookie           | localStorage | sessionStorage       | IndexedDB     |
| --------------- | ---------------- | ------------ | -------------------- | ------------- |
| Size limit      | 4KB              | 5MB          | 5MB                  | No real limit |
| Lifetime        | Configurable TTL | Permanent    | Cleared on tab close | Permanent     |
| Sent w/ request | Yes              | No           | No                   | No            |
| Sync/Async      | Sync             | Sync         | Sync                 | Async         |
| Supported types | String           | String       | String               | Any type      |

## Cookie

Primary use: server-side reading (authentication). Cookie should not be your first choice for frontend data storage.

```javascript
// Read/write
document.cookie =
  "username=Alice; expires=Thu, 31 Dec 2018 23:59:59 GMT; path=/";
const cookies = document.cookie; // 'username=Alice; token=xxx'

// Cookie is hard to use directly, usually wrapped in utility functions
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
```

**Security attributes:**

- `HttpOnly`: JS cannot read it, prevents XSS token theft
- `Secure`: only sent over HTTPS
- `SameSite=Strict`: prevents CSRF

## localStorage

The most commonly used frontend storage, for persisting user preferences and cached data:

```javascript
// Store (only supports strings, objects must be serialized)
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));

// Read
const user = JSON.parse(localStorage.getItem("user"));

// Delete
localStorage.removeItem("user");
localStorage.clear(); // clear all

// Iterate all keys
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
}
```

**A typed wrapper:**

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

Identical API to localStorage; the difference is data disappears when the tab is closed and is not shared across tabs.

Good for: form drafts, intermediate state in multi-step wizards.

## IndexedDB

A true client-side database for large amounts of structured data. The native API is quite verbose:

```javascript
// Open database
const request = indexedDB.open("myDB", 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  // Create object store (like a table)
  const store = db.createObjectStore("users", { keyPath: "id" });
  store.createIndex("name", "name", { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // Write
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").add({ id: 1, name: "Alice", age: 25 });

  // Read
  const readTx = db.transaction("users", "readonly");
  const getRequest = readTx.objectStore("users").get(1);
  getRequest.onsuccess = () => console.log(getRequest.result);
};
```

The native API involves deeply nested callbacks. The `idb` library wraps it with Promises:

```javascript
import { openDB } from "idb";

const db = await openDB("myDB", 1, {
  upgrade(db) {
    db.createObjectStore("users", { keyPath: "id" });
  },
});

// Write
await db.put("users", { id: 1, name: "Alice" });

// Read
const user = await db.get("users", 1);
```

## Selection Guide

- **Server needs to read it** (e.g. session token) → Cookie (with HttpOnly)
- **Small user preferences/config** (theme, language) → localStorage
- **Temporary form state** → sessionStorage
- **Offline cache of large amounts of data** (article lists, image metadata) → IndexedDB
- **Large file storage** (audio/video) → Cache API (PWA scenarios)

## Summary

localStorage is sufficient for most cases. Remember to serialize/deserialize, and add try/catch (writing to localStorage in private browsing mode throws an exception).
