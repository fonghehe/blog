---
title: "TypeScript 實用工具型別深入"
date: 2019-06-08 09:40:54
tags:
  - TypeScript
readingTime: 1
description: "用 TypeScript 一年多，工具型別（Utility Types）是用得最多的高階特性。整理一下常用的和自定義工具型別。"
---

用 TypeScript 一年多，工具型別（Utility Types）是用得最多的高階特性。整理一下常用的和自定義工具型別。

## 內建工具型別

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

// Partial：所有屬性變可選
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; age?: number }

// Required：所有屬性變必填
type RequiredUser = Required<User>;
// { id: number; name: string; email: string; age: number }

// Pick：挑選屬性
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string }

// Omit：排除屬性
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; age?: number }

// Record：構建對映物件
type UserMap = Record<string, User>;
const userMap: UserMap = { alice: { id: 1, name: "Alice", email: "a@b.com" } };

// Readonly：只讀
type ReadonlyUser = Readonly<User>;

// NonNullable：去掉 null 和 undefined
type T = NonNullable<string | null | undefined>; // string
```

## 條件型別

```typescript
// T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer：從型別中提取
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }

// 提取 Promise 的值型別
type Awaited<T> = T extends Promise<infer U> ? U : T;
type Result = Awaited<Promise<string>>; // string
```

## 常用自定義工具型別

```typescript
// DeepPartial：深層可選
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// DeepReadonly：深層只讀
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// 提取物件中值為某型別的鍵
type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

interface Form {
  name: string;
  age: number;
  email: string;
  score: number;
}

type StringKeys = KeysOfType<Form, string>; // 'name' | 'email'
type NumberKeys = KeysOfType<Form, number>; // 'age' | 'score'

// 函式引數型別提取
type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

function createUser(name: string, age: number) {}
type CreateUserParams = Parameters<typeof createUser>; // [string, number]
```

## 在 Vue 專案中的實踐

```typescript
// 用工具型別定義元件 Props
interface ButtonProps {
  type: "primary" | "default" | "danger";
  size: "large" | "medium" | "small";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

// 所有 Props 都可選（帶預設值）
type OptionalButtonProps = Partial<ButtonProps>;

// API 響應型別
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

type UserResponse = ApiResponse<User>;
type UserListResponse = ApiResponse<{ list: User[]; total: number }>;

// 分頁請求通用引數
interface PaginationParams {
  page: number;
  pageSize: number;
}

type UserListParams = PaginationParams & {
  keyword?: string;
  role?: string;
};
```

## 小結

- 內建工具型別（Partial/Required/Pick/Omit/Record）要熟練使用
- 條件型別 + `infer` 實現型別推導，`ReturnType`、`Parameters` 很實用
- 自定義工具型別複用型別邏輯，避免重複定義
- 泛型 + 工具型別是 TS 高階使用的核心
