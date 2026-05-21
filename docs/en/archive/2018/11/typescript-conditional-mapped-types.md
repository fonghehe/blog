---
title: "TypeScript Advanced Types: Conditional Types and Mapped Types"
date: 2018-11-17 17:27:11
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 2.8 introduced conditional types, and TypeScript 2.1 introduced mapped types. These two features can be combined to build extremely powerful type uti"
wordCount: 119
---

TypeScript 2.8 introduced conditional types, and TypeScript 2.1 introduced mapped types. These two features can be combined to build extremely powerful type utilities.

## Mapped Types

Generate new types based on an existing type:

```typescript
// Make all properties optional
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// Make all properties readonly
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Make all properties required
type Required<T> = {
  [K in keyof T]-?: T[K]; // -? removes the optional modifier
};

// Change all property values to another type
type Record<K extends keyof any, V> = {
  [P in K]: V;
};

// Examples
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

## Conditional Types

```typescript
// T extends U ? X : Y
// If T is assignable to U, the type is X; otherwise Y

type IsArray<T> = T extends any[] ? true : false;

type A = IsArray<string[]>; // true
type B = IsArray<number>; // false
```

## Built-in Utility Types

```typescript
// Extract: extract from T what can be assigned to U
type Extract<T, U> = T extends U ? T : never;

type NumberOrString = Extract<string | number | boolean, string | number>;
// string | number

// Exclude: exclude from T what can be assigned to U
type Exclude<T, U> = T extends U ? never : T;

type NotBoolean = Exclude<string | number | boolean, boolean>;
// string | number

// ReturnType: get the return type of a function
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

## infer: Type Inference

`infer` is used to "capture" a sub-type inside a conditional type:

```typescript
// Get the inner type of a Promise
type Awaited<T> = T extends Promise<infer Inner> ? Inner : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<number[]>>; // number[]
type C = Awaited<string>; // string (not a Promise — returned as is)

// Get the element type of an array
type ArrayItem<T> = T extends (infer Item)[] ? Item : never;

type N = ArrayItem<number[]>; // number
type S = ArrayItem<string[]>; // string

// Get the type of a function's first parameter
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any
  ? F
  : never;

type P = FirstParam<(a: string, b: number) => void>; // string
```

## Real-world Use: API Type Utilities

```typescript
// Define the API response structure
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// Extract the data type from an API response
type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

// Define an API function
async function getUserList(): Promise<ApiResponse<User[]>> {
  const res = await fetch("/api/users");
  return res.json();
}

// Infer: UserList = User[]
type UserList = ExtractData<Awaited<ReturnType<typeof getUserList>>>;
```

## Omit: Remove Specific Properties

```typescript
// Built-in since TS 3.5; manual implementation:
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

interface User {
  id: number;
  name: string;
  password: string;
  createdAt: Date;
}

// Remove sensitive fields
type PublicUser = Omit<User, "password" | "createdAt">;
// { id: number; name: string }
```

## Summary

- Mapped types: iterate over `[K in keyof T]` to generate new types
- Conditional types: `T extends U ? X : Y` — choose a type based on a condition
- `infer`: infer sub-types within conditional types
- Built-in utilities: `Partial`, `Required`, `Readonly`, `Record`, `Omit`, `Extract`, `Exclude`
- These features let you build type-safe utility functions and reduce repetitive type definitions
