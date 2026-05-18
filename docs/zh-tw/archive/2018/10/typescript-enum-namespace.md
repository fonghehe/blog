---
title: "TypeScript 列舉和名稱空間"
date: 2018-10-21 10:31:26
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 的列舉（enum）是很多人從 Java/C# 來的必用特性，但在 TS 裡有一些值得注意的地方。名稱空間（namespace）用的少，但也有合適的場景。"
---

TypeScript 的列舉（enum）是很多人從 Java/C# 來的必用特性，但在 TS 裡有一些值得注意的地方。名稱空間（namespace）用的少，但也有合適的場景。

## 數字列舉

```typescript
enum Direction {
  Up, // 0
  Down, // 1
  Left, // 2
  Right, // 3
}

console.log(Direction.Up); // 0
console.log(Direction[0]); // 'Up'（反向對映）
```

數字列舉會雙向對映（值→名稱，名稱→值），所以編譯後的程式碼量較多。

## 字串列舉（更推薦）

```typescript
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 優點：除錯時可讀，不是 0/1/2 這種無意義數字
console.log(Status.Active); // 'ACTIVE'

// 使用
function updateUser(status: Status) {
  api.patch("/user", { status });
}
updateUser(Status.Active);
```

## const enum：編譯時內聯

```typescript
// 普通 enum 編譯後會生成物件
// const enum 會被內聯替換（更小的 bundle）
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir = Direction.Up;
// 編譯後：const dir = 'UP'（直接替換，沒有物件）
```

注意：`const enum` 不支援反向對映，也不能用 `Object.values(Direction)`。

## 列舉的替代方案（更現代）

很多場景可以用聯合型別代替列舉：

```typescript
// 列舉寫法
enum Status {
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 聯合型別寫法（更簡潔）
type Status = "ACTIVE" | "DISABLED";

// 或者用 as const 物件（可以 Object.values）
const STATUS = {
  Active: "ACTIVE",
  Disabled: "DISABLED",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'ACTIVE' | 'DISABLED'

// 獲取所有值
Object.values(STATUS); // ['ACTIVE', 'DISABLED']
```

## 名稱空間

名稱空間在 ES6 模組化普及之前用於組織程式碼，現在主要用於給第三方 JS 庫寫宣告檔案：

```typescript
// 宣告 window 上的全域性變數
declare namespace window {
  const __CONFIG__: {
    apiUrl: string;
    version: string;
  };
}

// 使用
console.log(window.__CONFIG__.apiUrl);
```

```typescript
// 給 jQuery 這類全域性庫寫型別宣告
declare namespace $ {
  function ajax(url: string, options?: object): Promise<any>;
  namespace fn {
    function extend(plugin: object): void;
  }
}
```

## 實際專案建議

```typescript
// 介面狀態等：用字串字面量聯合型別
type ApiStatus = "idle" | "loading" | "success" | "error";

// 需要迭代所有值時：用 as const 物件
const ROLES = {
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const;

// 需要反向對映時：用普通 enum
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

## 小結

- 數字列舉：有反向對映，但數字可讀性差
- 字串列舉：可讀性好，推薦用
- `const enum`：編譯時內聯，更小的 bundle，但功能有限制
- 現代替代：聯合型別或 `as const` 物件，更靈活
- 名稱空間：主要用於宣告檔案，業務程式碼用 ES module
