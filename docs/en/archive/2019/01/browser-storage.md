---
title: "Browser Storage Compared: Cookie, localStorage, and IndexedDB"
date: 2019-01-31 09:50:31
tags:
  - Frontend
readingTime: 1
description: "After years of frontend development, unclear storage choices have led to many pitfalls. Here's a systematic overview."
---

After years of frontend development, unclear storage choices have led to many pitfalls. Here's a systematic overview.

## Comparison of Each Option

|                   | Cookie                  | sessionStorage | localStorage | IndexedDB    |
| ----------------- | ----------------------- | -------------- | ------------ | ------------ |
| Capacity          | 4KB                     | 5-10MB         | 5-10MB       | >250MB       |
| Lifetime          | Set expiry time         | Tab close      | Permanent    | Permanent    |
| Server access     | ✅ (sent with requests) | ❌             | ❌           | ❌           |
| API               | String manipulation     | Synchronous    | Synchronous  | Asynchronous |
| Cross-tab sharing | ✅                      | ❌             | ✅           | ✅           |

## Cookie

```javascript
// Reading/writing Cookies (the native API is cumbersome)
document.cookie = "token=abc123; max-age=86400; path=/; SameSite=Strict";

// Recommended: use the js-cookie library
import Cookies from "js-cookie";

Cookies.set("token", "abc123", { expires: 1 }); // expires in 1 day
Cookies.get("token");
Cookies.remove("token");
```

Security attributes:

- `HttpOnly`: cannot be read by JS (only set by the backend), prevents XSS token theft
- `Secure`: transmitted over HTTPS only
- `SameSite=Strict/Lax`: prevents CSRF

## localStorage

```javascript
// Can only store strings; objects must be serialized
localStorage.setItem("user", JSON.stringify({ name: "Alice", role: "admin" }));
const user = JSON.parse(localStorage.getItem("user"));
localStorage.removeItem("user");
localStorage.clear();

// A wrapper with expiry time support
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

Used for storing large amounts of structured data (caching API responses, offline data, etc.).

```javascript
// The native API is event-based and verbose; the idb library is recommended
import { openDB } from "idb";

const db = await openDB("my-app", 1, {
  upgrade(db) {
    const store = db.createObjectStore("cache", { keyPath: "key" });
    store.createIndex("expiry", "expiry");
  },
});

// Write
await db.put("cache", {
  key: "user-list",
  data: users,
  expiry: Date.now() + 300000,
});

// Read
const cached = await db.get("cache", "user-list");
if (cached && cached.expiry > Date.now()) {
  return cached.data;
}
```
