---
title: "TypeScript 條件類型深入"
date: 2019-09-23 11:02:29
tags:
  - TypeScript
readingTime: 4
description: "TypeScript 的條件類型（Conditional Types）是類型系統中最強大的特性之一。它讓我們可以根據類型的條件分支來動態生成新的類型，類似於 JavaScript 中的三元表達式。配合泛型和 `infer` 關鍵字，條件類型可以實現極其靈活的類型推導。本文將從基礎語法到高級用法，深入講解條件類型。"
---

TypeScript 的條件類型（Conditional Types）是類型系統中最強大的特性之一。它讓我們可以根據類型的條件分支來動態生成新的類型，類似於 JavaScript 中的三元表達式。配合泛型和 `infer` 關鍵字，條件類型可以實現極其靈活的類型推導。本文將從基礎語法到高級用法，深入講解條件類型。

## 條件類型基礎語法

條件類型使用 `extends` 關鍵字進行類型判斷：

```ts
// 基本語法：T extends U ? X : Y
// 如果 T 可以賦值給 U，結果是 X，否則是 Y

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
type C = IsString<'hello'>; // true (字面量類型是 string 的子類型)
```

## 分佈式條件類型

當條件類型的參數是聯合類型時，條件類型會自動分發（distribute）：

```ts
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// 結果：string[] | number[]（不是 (string | number)[]）

// 如果不想分發，用方括號包裹
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// 結果：(string | number)[]
```

### 實用示例：排除特定類型

```ts
// 實現 Exclude
type MyExclude<T, U> = T extends U ? never : T;

type Result = MyExclude<string | number | boolean, string>;
// 分發過程：
// string extends string ? never : string  => never
// number extends string ? never : number  => number
// boolean extends string ? never : boolean => boolean
// 結果：number | boolean

// 實現 Extract
type MyExtract<T, U> = T extends U ? T : never;

type Result2 = MyExtract<string | number | boolean, string | number>;
// 結果：string | number
```

## infer 關鍵字

`infer` 是條件類型中用於類型推斷的關鍵字，只能在 `extends` 子句中使用：

### 推斷函數返回值類型

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;           // string
type B = ReturnType<(x: number) => boolean>; // boolean
type C = ReturnType<string>;                  // never

// 實際使用
function getUser() {
  return { id: 1, name: '張三', age: 25 };
}

type User = ReturnType<typeof getUser>;
// { id: number; name: string; age: number }
```

### 推斷函數參數類型

```ts
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

type A = Parameters<(a: string, b: number) => void>;
// [string, number]

type B = Parameters<() => void>;
// []

// 實際使用
function createUser(name: string, age: number, email: string) {
  return { name, age, email };
}

type CreateUserParams = Parameters<typeof createUser>;
// [string, number, string]
```

### 推斷 Promise 內部類型

```ts
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>; // string
type B = UnwrapPromise<Promise<number[]>>; // number[]
type C = UnwrapPromise<boolean>; // boolean

// 遞歸解包
type DeepUnwrapPromise<T> = T extends Promise<infer U>
  ? DeepUnwrapPromise<U>
  : T;

type D = DeepUnwrapPromise<Promise<Promise<string>>>; // string

// 實際使用
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json() as Promise<{ id: number; name: string }>;
}

type FetchResult = DeepUnwrapPromise<ReturnType<typeof fetchData>>;
// { id: number; name: string }
```

### 推斷數組元素類型

```ts
type ElementOf<T> = T extends (infer E)[] ? E : never;

type A = ElementOf<string[]>;      // string
type B = ElementOf<number[]>;      // number
type C = ElementOf<[string, number]>; // string | number
type D = ElementOf<string>;        // never

// 推斷元組第一個元素
type First<T> = T extends [infer F, ...any[]] ? F : never;

type E = First<[string, number, boolean]>; // string
type F = First<[]>; // never

// 推斷元組最後一個元素
type Last<T> = T extends [...any[], infer L] ? L : never;

type G = Last<[string, number, boolean]>; // boolean
```

### 推斷對象屬性類型

```ts
type ValueType<T> = T extends { value: infer V } ? V : never;

type A = ValueType<{ value: string }>;  // string
type B = ValueType<{ value: number[] }>; // number[]
type C = ValueType<{ name: string }>;    // never
```

## 實戰：API 響應類型推導

```ts
// 定義 API 接口映射
interface ApiEndpoints {
  '/users': {
    GET: { response: { id: number; name: string }[] };
    POST: {
      body: { name: string; email: string };
      response: { id: number };
    };
  };
  '/users/:id': {
    GET: { response: { id: number; name: string; email: string } };
    PUT: {
      body: { name?: string; email?: string };
      response: { success: boolean };
    };
    DELETE: { response: { success: boolean } };
  };
}

// 根據路徑和方法提取請求/響應類型
type ApiResponse<
  Endpoints extends Record<string, any>,
  Path extends keyof Endpoints,
  Method extends keyof Endpoints[Path]
> = Endpoints[Path][Method] extends { response: infer R } ? R : never;

type ApiBody<
  Endpoints extends Record<string, any>,
  Path extends keyof Endpoints,
  Method extends keyof Endpoints[Path]
> = Endpoints[Path][Method] extends { body: infer B } ? B : never;

// 使用
type UsersResponse = ApiResponse<ApiEndpoints, '/users', 'GET'>;
// { id: number; name: string }[]

type CreateUserBody = ApiBody<ApiEndpoints, '/users', 'POST'>;
// { name: string; email: string }

type CreateUserResponse = ApiResponse<ApiEndpoints, '/users', 'POST'>;
// { id: number }

// 類型安全的 API 客户端
async function apiCall<
  Path extends keyof ApiEndpoints,
  Method extends keyof ApiEndpoints[Path] & string
>(
  path: Path,
  method: Method,
  ...args: ApiBody<ApiEndpoints, Path, Method> extends never
    ? []
    : [body: ApiBody<ApiEndpoints, Path, Method>]
): Promise<ApiResponse<ApiEndpoints, Path, Method>> {
  const [body] = args;
  const response = await fetch(`/api${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}

// 使用 —— 完整的類型提示
const users = await apiCall('/users', 'GET');
// users: { id: number; name: string }[]

const newUser = await apiCall('/users', 'POST', {
  name: '張三',
  email: 'zhangsan@example.com',
});
// newUser: { id: number }
// 第三個參數有完整的類型提示，缺少必填字段會報錯
```

## 實戰：深度只讀類型

```ts
type DeepReadonly<T> = T extends (infer E)[]
  ? ReadonlyArray<DeepReadonly<E>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  features: string[];
}

type ReadonlyConfig = DeepReadonly<Config>;
// {
//   readonly database: {
//     readonly host: string;
//     readonly port: number;
//     readonly credentials: {
//       readonly username: string;
//       readonly password: string;
//     };
//   };
//   readonly features: ReadonlyArray<string>;
// }
```

## 實戰：類型安全的 EventEmitter

```ts
type EventMap = {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  error: { code: number; message: string };
};

class TypedEmitter<T extends Record<string, any>> {
  private handlers: Partial<{
    [K in keyof T]: Array<(data: T[K]) => void>;
  }> = {};

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.handlers[event]?.forEach(handler => handler(data));
  }
}

// 使用
const emitter = new TypedEmitter<EventMap>();

emitter.on('login', (data) => {
  console.log(data.userId);   // 類型提示：string
  console.log(data.timestamp); // 類型提示：number
});

emitter.emit('login', { userId: '123', timestamp: Date.now() }); // 正確
// emitter.emit('login', { userId: 123 }); // 類型錯誤！
```

## 小結

- 條件類型使用 `T extends U ? X : Y` 語法，根據類型關係進行分支判斷
- 聯合類型在條件類型中會自動分發（distribute），包裹 `[T]` 可以阻止分發
- `infer` 關鍵字可以在條件類型中推斷和提取子類型，是類型推導的核心工具
- 常用內置條件類型：`ReturnType`、`Parameters`、`Exclude`、`Extract`、`NonNullable`
- 條件類型可以遞歸使用，實現 `DeepReadonly`、`DeepUnwrapPromise` 等深層類型操作
- 實際項目中常用於：API 類型推導、事件系統類型安全、狀態管理類型定義
