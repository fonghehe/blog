---
title: "TypeScript interface 與 type 的區別"
date: 2018-09-08 10:55:44
tags:
  - TypeScript
readingTime: 1
description: "剛學 TypeScript 時經常困惑：`interface` 和 `type` 都能定義型別，什麼時候用哪個？"
---

剛學 TypeScript 時經常困惑：`interface` 和 `type` 都能定義型別，什麼時候用哪個？

## 相似之處

```typescript
// interface
interface User {
  id: number;
  name: string;
}

// type alias
type User = {
  id: number;
  name: string;
};

// 兩者都可以：
// - 描述物件結構
// - 可選屬性 ?
// - 只讀屬性 readonly
// - 被 class implements
// - 互相 extends/交叉
```

## 核心區別

### 1. interface 可以宣告合併（Declaration Merging）

```typescript
interface Window {
  myProp: string;
}
interface Window {
  anotherProp: number;
}
// 自動合併為：{ myProp: string; anotherProp: number }

// type 不能重複宣告：
type Foo = { a: string };
type Foo = { b: number }; // ❌ 報錯：重複宣告
```

這對擴充套件全域性型別（如 `Window`、`Vue`）很有用。

### 2. type 能表示更多型別

```typescript
// 聯合型別（interface 做不到）
type Status = "pending" | "success" | "error";
type ID = number | string;

// 元組
type Point = [number, number];

// 條件型別（interface 做不到）
type NonNullable<T> = T extends null | undefined ? never : T;

// 對映型別（interface 可以，但 type 更常見）
type Optional<T> = { [K in keyof T]?: T[K] };

// 函式型別（兩種都行，type 更簡潔）
type Handler = (event: MouseEvent) => void;
interface Handler {
  (event: MouseEvent): void;
}
```

### 3. extends 語法

```typescript
// interface 繼承：
interface Animal { name: string }
interface Dog extends Animal { breed: string }

// type 繼承（用交叉型別）：
type Animal = { name: string }
type Dog = Animal & { breed: string }

// interface 和 type 可以互相 extends：
interface A extends type B { ... }  // ✅
type C = interface D & { ... }      // ✅（通過交叉型別）
```

## 推薦實踐

**用 interface 的場景：**

- 描述物件/類的結構（語義更清晰）
- 需要宣告合併時（擴充套件第三方型別）
- 公共 API（便於使用方擴充套件）

**用 type 的場景：**

- 聯合型別、元組
- 工具型別（Conditional Types、Mapped Types）
- 函式型別（可讀性稍好）

```typescript
// 實際專案的規範
// 描述資料結構 → interface
interface User {
  id: number;
  name: string;
}
interface ApiResponse<T> {
  code: number;
  data: T;
}

// 工具型別 → type
type Nullable<T> = T | null;
type Optional<T> = { [K in keyof T]?: T[K] };

// 聯合型別 → type
type ButtonVariant = "primary" | "secondary" | "ghost";
type RequestStatus = "idle" | "loading" | "success" | "error";
```

## 小結

- `interface` 和 `type` 大多數場景可以互換
- `interface` 支援宣告合併，適合描述物件結構和公共 API
- `type` 更靈活，支援聯合型別、條件型別等
- 團隊統一規範比糾結哪個更好更重要
