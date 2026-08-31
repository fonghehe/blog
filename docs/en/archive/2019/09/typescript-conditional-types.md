---
title: "TypeScript Conditional Types In Depth"
date: 2019-09-23 11:02:29
tags:
  - TypeScript
readingTime: 3
description: "TypeScript's conditional types are among the most powerful features of the type system. They let us dynamically generate new types based on conditional branches over types, much like a ternary expression in JavaScript. Combined with generics and the `infer` keyword, conditional types enable extremely flexible type inference. This article goes from basic syntax to advanced usage, exploring conditional types in depth."
wordCount: 246
---

TypeScript's conditional types are among the most powerful features of the type system. They let us dynamically generate new types based on conditional branches over types, much like a ternary expression in JavaScript. Combined with generics and the `infer` keyword, conditional types enable extremely flexible type inference. This article goes from basic syntax to advanced usage, exploring conditional types in depth.

## Conditional Types Basic Syntax

Conditional types use the `extends` keyword for type checks:

```ts
// 基本语法：T extends U ? X : Y
// 如果 T 可以赋值给 U，结果是 X，否则是 Y

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
type C = IsString<'hello'>; // true (字面量类型是 string 的子类型)
```

## Distributive Conditional Types

When the parameter of a conditional type is a union, the conditional type distributes automatically:

```ts
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// 结果：string[] | number[]（不是 (string | number)[]）

// 如果不想分发，用方括号包裹
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// 结果：(string | number)[]
```

### Practical Example: Excluding Specific Types

```ts
// 实现 Exclude
type MyExclude<T, U> = T extends U ? never : T;

type Result = MyExclude<string | number | boolean, string>;
// 分发过程：
// string extends string ? never : string  => never
// number extends string ? never : number  => number
// boolean extends string ? never : boolean => boolean
// 结果：number | boolean

// 实现 Extract
type MyExtract<T, U> = T extends U ? T : never;

type Result2 = MyExtract<string | number | boolean, string | number>;
// 结果：string | number
```

## The infer Keyword

`infer` is the keyword for type inference inside conditional types; it can only be used within an `extends` clause:

### Inferring a Function's Return Type

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;           // string
type B = ReturnType<(x: number) => boolean>; // boolean
type C = ReturnType<string>;                  // never

// 实际使用
function getUser() {
  return { id: 1, name: '张三', age: 25 };
}

type User = ReturnType<typeof getUser>;
// { id: number; name: string; age: number }
```

### Inferring Function Parameter Types

```ts
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

type A = Parameters<(a: string, b: number) => void>;
// [string, number]

type B = Parameters<() => void>;
// []

// 实际使用
function createUser(name: string, age: number, email: string) {
  return { name, age, email };
}

type CreateUserParams = Parameters<typeof createUser>;
// [string, number, string]
```

### Inferring the Inner Type of a Promise

```ts
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>; // string
type B = UnwrapPromise<Promise<number[]>>; // number[]
type C = UnwrapPromise<boolean>; // boolean

// 递归解包
type DeepUnwrapPromise<T> = T extends Promise<infer U>
  ? DeepUnwrapPromise<U>
  : T;

type D = DeepUnwrapPromise<Promise<Promise<string>>>; // string

// 实际使用
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json() as Promise<{ id: number; name: string }>;
}

type FetchResult = DeepUnwrapPromise<ReturnType<typeof fetchData>>;
// { id: number; name: string }
```

### Inferring Array Element Types

```ts
type ElementOf<T> = T extends (infer E)[] ? E : never;

type A = ElementOf<string[]>;      // string
type B = ElementOf<number[]>;      // number
type C = ElementOf<[string, number]>; // string | number
type D = ElementOf<string>;        // never

// 推断元组第一个元素
type First<T> = T extends [infer F, ...any[]] ? F : never;

type E = First<[string, number, boolean]>; // string
type F = First<[]>; // never

// 推断元组最后一个元素
type Last<T> = T extends [...any[], infer L] ? L : never;

type G = Last<[string, number, boolean]>; // boolean
```

### Inferring Object Property Types

```ts
type ValueType<T> = T extends { value: infer V } ? V : never;

type A = ValueType<{ value: string }>;  // string
type B = ValueType<{ value: number[] }>; // number[]
type C = ValueType<{ name: string }>;    // never
```

## In Practice: API Response Type Inference

```ts
// 定义 API 接口映射
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

// 根据路径和方法提取请求/响应类型
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

// 类型安全的 API 客户端
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

// 使用 —— 完整的类型提示
const users = await apiCall('/users', 'GET');
// users: { id: number; name: string }[]

const newUser = await apiCall('/users', 'POST', {
  name: '张三',
  email: 'zhangsan@example.com',
});
// newUser: { id: number }
// 第三个参数有完整的类型提示，缺少必填字段会报错
```

## In Practice: Deep Readonly Types

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

## In Practice: Type-Safe EventEmitter

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
  console.log(data.userId);   // 类型提示：string
  console.log(data.timestamp); // 类型提示：number
});

emitter.emit('login', { userId: '123', timestamp: Date.now() }); // 正确
// emitter.emit('login', { userId: 123 }); // 类型错误！
```

## Summary

- Conditional types use the `T extends U ? X : Y` syntax to branch based on type relationships.
- Union types distribute automatically inside conditional types; wrapping with `[T]` prevents distribution.
- The `infer` keyword extracts subtypes within conditional types and is the core tool for type inference.
- Common built-in conditional types: `ReturnType`, `Parameters`, `Exclude`, `Extract`, `NonNullable`.
- Conditional types can be used recursively to implement deep type operations like `DeepReadonly` and `DeepUnwrapPromise`.
- In real projects they're commonly used for: API type inference, type-safe event systems, and state-management type definitions.
