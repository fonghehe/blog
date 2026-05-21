---
title: "TypeScript 实用工具类型深入"
date: 2019-06-08 09:40:54
tags:
  - TypeScript
readingTime: 1
description: "用 TypeScript 一年多，工具类型（Utility Types）是用得最多的高级特性。整理一下常用的和自定义工具类型。"
wordCount: 129
---

用 TypeScript 一年多，工具类型（Utility Types）是用得最多的高级特性。整理一下常用的和自定义工具类型。

## 内置工具类型

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

// Partial：所有属性变可选
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; age?: number }

// Required：所有属性变必填
type RequiredUser = Required<User>;
// { id: number; name: string; email: string; age: number }

// Pick：挑选属性
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string }

// Omit：排除属性
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; age?: number }

// Record：构建映射对象
type UserMap = Record<string, User>;
const userMap: UserMap = { alice: { id: 1, name: "Alice", email: "a@b.com" } };

// Readonly：只读
type ReadonlyUser = Readonly<User>;

// NonNullable：去掉 null 和 undefined
type T = NonNullable<string | null | undefined>; // string
```

## 条件类型

```typescript
// T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer：从类型中提取
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }

// 提取 Promise 的值类型
type Awaited<T> = T extends Promise<infer U> ? U : T;
type Result = Awaited<Promise<string>>; // string
```

## 常用自定义工具类型

```typescript
// DeepPartial：深层可选
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// DeepReadonly：深层只读
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// 提取对象中值为某类型的键
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

// 函数参数类型提取
type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

function createUser(name: string, age: number) {}
type CreateUserParams = Parameters<typeof createUser>; // [string, number]
```

## 在 Vue 项目中的实践

```typescript
// 用工具类型定义组件 Props
interface ButtonProps {
  type: "primary" | "default" | "danger";
  size: "large" | "medium" | "small";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

// 所有 Props 都可选（带默认值）
type OptionalButtonProps = Partial<ButtonProps>;

// API 响应类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

type UserResponse = ApiResponse<User>;
type UserListResponse = ApiResponse<{ list: User[]; total: number }>;

// 分页请求通用参数
interface PaginationParams {
  page: number;
  pageSize: number;
}

type UserListParams = PaginationParams & {
  keyword?: string;
  role?: string;
};
```

## 小结

- 内置工具类型（Partial/Required/Pick/Omit/Record）要熟练使用
- 条件类型 + `infer` 实现类型推导，`ReturnType`、`Parameters` 很实用
- 自定义工具类型复用类型逻辑，避免重复定义
- 泛型 + 工具类型是 TS 高级使用的核心
