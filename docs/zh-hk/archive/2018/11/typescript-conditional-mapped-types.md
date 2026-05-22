---
title: "TypeScript 高級類型：條件類型和映射類型"
date: 2018-11-17 17:27:11
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 2.8 引入了條件類型，TypeScript 2.1 引入了映射類型。這兩個特性可以構建出非常強大的類型工具。"
wordCount: 188
---

TypeScript 2.8 引入了條件類型，TypeScript 2.1 引入了映射類型。這兩個特性可以構建出非常強大的類型工具。

## 映射類型

基於已有類型生成新類型：

```typescript
// 把所有屬性變為可選
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 把所有屬性變為隻讀
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// 把所有屬性變為必填
type Required<T> = {
  [K in keyof T]-?: T[K]; // -? 表示移除可選標記
};

// 把屬性值都改為另一個類型
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

## 條件類型

```typescript
// T extends U ? X : Y
// 如果 T 可以賦值給 U，則類型為 X，否則為 Y

type IsArray<T> = T extends any[] ? true : false;

type A = IsArray<string[]>; // true
type B = IsArray<number>; // false
```

## 內置工具類型

```typescript
// Extract：從 T 中提取可以賦值給 U 的類型
type Extract<T, U> = T extends U ? T : never;

type NumberOrString = Extract<string | number | boolean, string | number>;
// string | number

// Exclude：從 T 中排除可以賦值給 U 的類型
type Exclude<T, U> = T extends U ? never : T;

type NotBoolean = Exclude<string | number | boolean, boolean>;
// string | number

// ReturnType：獲取函數返回值類型
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

## infer：類型推斷

`infer` 用於在條件類型中"捕獲"一個子類型：

```typescript
// 獲取 Promise 的內部類型
type Awaited<T> = T extends Promise<infer Inner> ? Inner : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<number[]>>; // number[]
type C = Awaited<string>; // string（不是 Promise，原樣返回）

// 獲取數組元素類型
type ArrayItem<T> = T extends (infer Item)[] ? Item : never;

type N = ArrayItem<number[]>; // number
type S = ArrayItem<string[]>; // string

// 獲取函數第一個參數類型
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any
  ? F
  : never;

type P = FirstParam<(a: string, b: number) => void>; // string
```

## 實際應用：API 類型工具

```typescript
// 定義 API 響應結構
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 從 API 響應中提取數據類型
type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

// 定義 API 函數
async function getUserList(): Promise<ApiResponse<User[]>> {
  const res = await fetch("/api/users");
  return res.json();
}

// 推斷出 UserList = User[]
type UserList = ExtractData<Awaited<ReturnType<typeof getUserList>>>;
```

## Omit：刪除指定屬性

```typescript
// TS 3.5 內置，自己實現：
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

## 小結

- 映射類型：`[K in keyof T]` 遍歷屬性，生成新類型
- 條件類型：`T extends U ? X : Y`，根據條件選擇類型
- `infer`：在條件類型中推斷子類型
- `Partial/Required/Readonly/Record/Omit/Extract/Exclude`：內置工具類型
- 這些特性可以構建出類型安全的工具函數，減少重複的類型定義
