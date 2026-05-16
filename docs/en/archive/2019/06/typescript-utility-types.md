---
title: "TypeScript Utility Types In Depth"
date: 2019-06-08 09:40:54
tags:
  - TypeScript
readingTime: 1
description: "TypeScript ships with a collection of utility types. Most developers know `Partial` and `Pick`, but the full library is much richer and more powerful than that."
---

TypeScript ships with a collection of utility types. Most developers know `Partial` and `Pick`, but the full library is much richer and more powerful than that.

## Built-in Utility Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  role: "admin" | "user" | "guest";
}

// Partial<T> — all properties become optional
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; ... }

// Required<T> — all properties become required (opposite of Partial)
type RequiredUser = Required<PartialUser>;

// Pick<T, K> — select a subset of properties
type UserProfile = Pick<User, "name" | "email">;
// { name: string; email: string }

// Omit<T, K> — exclude properties
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; age: number; role: ... }

// Record<K, V> — map type: key → value
type RoleMap = Record<User["role"], string[]>;
// { admin: string[]; user: string[]; guest: string[] }

// Readonly<T> — all properties become readonly
type ReadonlyUser = Readonly<User>;
// Cannot modify any property after assignment

// NonNullable<T> — remove null and undefined
type MaybeUser = User | null | undefined;
type DefiniteUser = NonNullable<MaybeUser>; // User

// ReturnType<T> — extract a function's return type
function fetchUser(): Promise<User> {
  /* ... */
}
type FetchResult = ReturnType<typeof fetchUser>; // Promise<User>

// Parameters<T> — extract a function's parameter types as a tuple
type FetchParams = Parameters<typeof fetchUser>; // []
```

## Conditional Types and infer

```typescript
// infer: extract a type from within a generic during conditional type matching
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
// UnpackPromise<Promise<string>> → string
// UnpackPromise<number>         → number

// Extract the element type from an array
type UnpackArray<T> = T extends Array<infer Item> ? Item : T;
// UnpackArray<string[]> → string

// Extract the return type of an async function
type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : never;

async function getUser(): Promise<User> {
  /* ... */
}
type UserType = AsyncReturnType<typeof getUser>; // User
```

## Custom DeepPartial

Built-in `Partial` is only one level deep. For nested objects, use a recursive version:

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      enabled: boolean;
      cert: string;
    };
  };
  database: {
    url: string;
    poolSize: number;
  };
}

// Deep partial — all nested properties are optional too
type PartialConfig = DeepPartial<Config>;
const config: PartialConfig = {
  server: {
    host: "localhost",
    // port, ssl can be omitted
  },
  // database can be omitted entirely
};
```

TypeScript's utility type system is one of its most powerful features. Invest time in learning the built-in utilities before writing your own — they cover the majority of real-world scenarios.
