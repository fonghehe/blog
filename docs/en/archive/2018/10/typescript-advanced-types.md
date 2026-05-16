---
title: "TypeScript Advanced Types: Conditional Types and Mapped Types"
date: 2018-10-16 09:34:02
tags:
  - TypeScript
readingTime: 1
description: "After learning basic generics, I dug into conditional types and mapped types and found that TypeScript's type system is far more powerful than I had imagined."
---

After learning basic generics, I dug into conditional types and mapped types and found that TypeScript's type system is far more powerful than I had imagined.

## Conditional Types

```typescript
// Format: T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// Built-in conditional utility types
type NonNullable<T> = T extends null | undefined ? never : T;
type NonNullableStr = NonNullable<string | null>; // string

// Used inside generics
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function fetchUser() {
  return { id: 1, name: "Alice" };
}
type UserType = ReturnType<typeof fetchUser>;
// { id: number; name: string }
```

## infer: Type Inference

```typescript
// Extract the inner type of a Promise
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<string>; // string

// Extract function parameter types
type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

function greet(name: string, age: number) {
  return `${name} is ${age}`;
}
type GreetParams = Parameters<typeof greet>; // [string, number]
```

## Mapped Types

Iterate over the keys of an existing type to produce a new type:

```typescript
// Basic mapping
type Optional<T> = {
  [K in keyof T]?: T[K]; // make all properties optional
};

type Readonly<T> = {
  readonly [K in keyof T]: T[K]; // make all properties read-only
};

// Modify property types
type Stringify<T> = {
  [K in keyof T]: string; // change all property values to string
};

// Filter properties
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

interface User {
  id: number;
  name: string;
  age: number;
  email: string;
}

// Keep only string-type properties
type StringFields = PickByValue<User, string>;
// { name: string; email: string }
```

## Composing Utility Types

```typescript
// Deep partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Deep readonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Get the type of the first function parameter
type FirstParameter<T extends (...args: any) => any> = T extends (
  first: infer F,
  ...args: any
) => any
  ? F
  : never;
```

## Template Literal Types (TypeScript 4.1, Preview)

Still in proposal stage, but coming soon:

```typescript
// Future (TS 4.1)
type EventName<T extends string> = `on${Capitalize<T>}`;
type Handlers = EventName<"click" | "change">; // 'onClick' | 'onChange'
```

## Real-world Use: Strict Event Types

```typescript
type Events = {
  "user:login": { userId: number; name: string };
  "user:logout": void;
  "data:loaded": { items: any[]; total: number };
};

class TypedEventEmitter {
  private listeners: Partial<{
    [K in keyof Events]: ((data: Events[K]) => void)[];
  }> = {};
}
```

## Summary

- Conditional types (`T extends U ? X : Y`) enable type-level branching logic
- `infer` captures sub-types inside conditional types (e.g., `Promise<infer U>`)
- Mapped types iterate over `keyof T` to transform each property
- Combining conditional and mapped types lets you build powerful utility types like `DeepPartial`, `DeepReadonly`, and `PickByValue`
