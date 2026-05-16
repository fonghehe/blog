---
title: "TypeScript Generic Programming Patterns In Depth"
date: 2019-05-29 10:19:35
tags:
  - TypeScript
readingTime: 1
description: "Generics are one of the most powerful features in TypeScript's type system. Many people only know the basic `Array<T>` usage, but generics combined with conditi"
---

Generics are one of the most powerful features in TypeScript's type system. Many people only know the basic `Array<T>` usage, but generics combined with conditional types, mapped types, and the `infer` keyword can achieve very flexible type inference. This article systematically covers generic programming patterns from basics to real-world usage.

## Generics Basics

The core idea of generics: **types are parameters**. Just like functions accept value parameters, generic functions and interfaces accept type parameters.

```typescript
// Without generics: either lose type information or write the same code multiple times
function identityNumber(arg: number): number {
  return arg;
}
function identityString(arg: string): string {
  return arg;
}
// Writing one function per type is obviously impractical

// With generics
function identity<T>(arg: T): T {
  return arg;
}

// TypeScript automatically infers T
const a = identity("hello"); // T is inferred as string
const b = identity(42); // T is inferred as number

// You can also specify the type explicitly
const c = identity<string>("hello");
```

### Generics in Interfaces and Classes

```typescript
// Generic interface
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface User {
  id: number;
  name: string;
}

type UserResponse = ApiResponse<User>;
// Equivalent to: { code: number; message: string; data: User }

// Generic class
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }
}

const numberQueue = new Queue<number>();
numberQueue.enqueue(1);
numberQueue.enqueue(2);
// numberQueue.enqueue('three'); // compile error

const stringQueue = new Queue<string>();
```

## Constrained Generics

```typescript
// extends constrains what T can be
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25 };
getProperty(user, "name"); // string
getProperty(user, "age"); // number
// getProperty(user, 'foo'); // compile error: 'foo' is not a key of user
```

## Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer: extract a type from another
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }

// Extract the resolved value type of a Promise
type Awaited<T> = T extends Promise<infer U> ? U : T;
type Result = Awaited<Promise<string>>; // string
```

Mastering generics is key to writing reusable, type-safe TypeScript — it unlocks the full power of the type system.
