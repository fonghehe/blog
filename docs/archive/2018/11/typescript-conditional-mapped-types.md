---
title: "TypeScript 高级类型：条件类型和映射类型"
date: 2018-11-17 17:27:11
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 2.8 引入了条件类型，TypeScript 2.1 引入了映射类型。这两个特性可以构建出非常强大的类型工具。"
---

TypeScript 2.8 引入了条件类型，TypeScript 2.1 引入了映射类型。这两个特性可以构建出非常强大的类型工具。

## 映射类型

基于已有类型生成新类型：

```typescript
// 把所有属性变为可选
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 把所有属性变为只读
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// 把所有属性变为必填
type Required<T> = {
  [K in keyof T]-?: T[K]; // -? 表示移除可选标记
};

// 把属性值都改为另一个类型
type Record<K extends keyof any, V> = {
  [P in K]: V;
};

// 例子
interface User {
  name: string;
  age: number;
  email?: string;
}

type PartialUser = Partial<User>;
// { name?: string; age?: number; email?: string }

type UserRecord = Record<"admin" | "editor", User>;
// { admin: User; editor: User }
```

## 条件类型

```typescript
// T extends U ? X : Y
// 如果 T 可以赋值给 U，则类型为 X，否则为 Y

type IsArray<T> = T extends any[] ? true : false;

type A = IsArray<string[]>; // true
type B = IsArray<number>; // false
```

## 内置工具类型

```typescript
// Extract：从 T 中提取可以赋值给 U 的类型
type Extract<T, U> = T extends U ? T : never;

type NumberOrString = Extract<string | number | boolean, string | number>;
// string | number

// Exclude：从 T 中排除可以赋值给 U 的类型
type Exclude<T, U> = T extends U ? never : T;

type NotBoolean = Exclude<string | number | boolean, boolean>;
// string | number

// ReturnType：获取函数返回值类型
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : any;

function fetchUser(): Promise<{ id: number; name: string }> {
  return fetch("/api/user").then((r) => r.json());
}

type FetchResult = ReturnType<typeof fetchUser>;
// Promise<{ id: number; name: string }>
```

## infer：类型推断

`infer` 用于在条件类型中"捕获"一个子类型：

```typescript
// 获取 Promise 的内部类型
type Awaited<T> = T extends Promise<infer Inner> ? Inner : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<number[]>>; // number[]
type C = Awaited<string>; // string（不是 Promise，原样返回）

// 获取数组元素类型
type ArrayItem<T> = T extends (infer Item)[] ? Item : never;

type N = ArrayItem<number[]>; // number
type S = ArrayItem<string[]>; // string

// 获取函数第一个参数类型
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any
  ? F
  : never;

type P = FirstParam<(a: string, b: number) => void>; // string
```

## 实际应用：API 类型工具

```typescript
// 定义 API 响应结构
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 从 API 响应中提取数据类型
type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

// 定义 API 函数
async function getUserList(): Promise<ApiResponse<User[]>> {
  const res = await fetch("/api/users");
  return res.json();
}

// 推断出 UserList = User[]
type UserList = ExtractData<Awaited<ReturnType<typeof getUserList>>>;
```

## Omit：删除指定属性

```typescript
// TS 3.5 内置，自己实现：
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

interface User {
  id: number;
  name: string;
  password: string;
  createdAt: Date;
}

// 去掉敏感字段
type PublicUser = Omit<User, "password" | "createdAt">;
// { id: number; name: string }
```

## 小结

- 映射类型：`[K in keyof T]` 遍历属性，生成新类型
- 条件类型：`T extends U ? X : Y`，根据条件选择类型
- `infer`：在条件类型中推断子类型
- `Partial/Required/Readonly/Record/Omit/Extract/Exclude`：内置工具类型
- 这些特性可以构建出类型安全的工具函数，减少重复的类型定义
