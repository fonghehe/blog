---
title: "TypeScript 枚舉和命名空間：落地路徑與實戰建議"
date: 2018-10-21 10:31:26
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 的枚舉（enum）是很多人從 Java/C# 來的必用特性，但在 TS 裏有一些值得注意的地方。命名空間（namespace）用的少，但也有合適的場景。"
wordCount: 274
---

TypeScript 的枚舉（enum）是很多人從 Java/C# 來的必用特性，但在 TS 裏有一些值得注意的地方。命名空間（namespace）用的少，但也有合適的場景。

## 數字枚舉

```typescript
enum Direction {
  Up, // 0
  Down, // 1
  Left, // 2
  Right, // 3
}

console.log(Direction.Up); // 0
console.log(Direction[0]); // 'Up'（反向映射）
```

數字枚舉會雙向映射（值→名稱，名稱→值），所以編譯後的代碼量較多。

## 字符串枚舉（更推薦）

```typescript
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 優點：調試時可讀，不是 0/1/2 這種無意義數字
console.log(Status.Active); // 'ACTIVE'

// 使用
function updateUser(status: Status) {
  api.patch("/user", { status });
}
updateUser(Status.Active);
```

## const enum：編譯時內聯

```typescript
// 普通 enum 編譯後會生成對象
// const enum 會被內聯替換（更小的 bundle）
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir = Direction.Up;
// 編譯後：const dir = 'UP'（直接替換，沒有對象）
```

注意：`const enum` 不支持反向映射，也不能用 `Object.values(Direction)`。

## 枚舉的替代方案（更現代）

很多場景可以用聯合類型代替枚舉：

```typescript
// 枚舉寫法
enum Status {
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 聯合類型寫法（更簡潔）
type Status = "ACTIVE" | "DISABLED";

// 或者用 as const 對象（可以 Object.values）
const STATUS = {
  Active: "ACTIVE",
  Disabled: "DISABLED",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'ACTIVE' | 'DISABLED'

// 獲取所有值
Object.values(STATUS); // ['ACTIVE', 'DISABLED']
```

## 命名空間

命名空間在 ES6 模塊化普及之前用於組織代碼，現在主要用於給第三方 JS 庫寫聲明文件：

```typescript
// 聲明 window 上的全局變量
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
// 給 jQuery 這類全局庫寫類型聲明
declare namespace $ {
  function ajax(url: string, options?: object): Promise<any>;
  namespace fn {
    function extend(plugin: object): void;
  }
}
```

## 實際項目建議

```typescript
// 接口狀態等：用字符串字面量聯合類型
type ApiStatus = "idle" | "loading" | "success" | "error";

// 需要迭代所有值時：用 as const 對象
const ROLES = {
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const;

// 需要反向映射時：用普通 enum
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

## 小結

- 數字枚舉：有反向映射，但數字可讀性差
- 字符串枚舉：可讀性好，推薦用
- `const enum`：編譯時內聯，更小的 bundle，但功能有限製
- 現代替代：聯合類型或 `as const` 對象，更靈活
- 命名空間：主要用於聲明文件，業務代碼用 ES module
