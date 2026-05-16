---
title: "TypeScript Mapped Types In Depth"
date: 2019-07-25 16:35:13
tags:
  - TypeScript
readingTime: 2
description: "TypeScript's type system is very powerful, and Mapped Types are one of its most practical features. They allow you to create new types based on existing ones, b"
---

TypeScript's type system is very powerful, and Mapped Types are one of its most practical features. They allow you to create new types based on existing ones, bulk-modifying property modifiers. This article covers mapped types from basics to real-world usage.

## Basic Syntax

The core syntax of mapped types:

```typescript
type MappedType<T> = {
  [K in keyof T]: T[K];
};
```

- `keyof T`: gets all keys of T as a union type
- `K in keyof T`: iterates over each key
- `T[K]`: gets the type for key K in T (indexed access type)

A simple example:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

// Change all properties to string type
type StringifyUser = {
  [K in keyof User]: string;
};
// Equivalent to:
// {
//   id: string
//   name: string
//   email: string
//   age: string
// }
```

## Readonly Modifier: readonly +/-

`+` adds a modifier (default, can be omitted), `-` removes it:

```typescript
// Add readonly (all properties become readonly)
type ReadonlyUser = {
  readonly [K in keyof User]: User[K];
};

// Remove readonly
type MutableUser = {
  -readonly [K in keyof ReadonlyUser]: ReadonlyUser[K];
};

// TypeScript's built-in Readonly<T> is implemented this way:
// type Readonly<T> = {
//   readonly [P in keyof T]: T[P]
// }
```

## Optional Modifier: ? +/-

```typescript
// All properties become optional
type PartialUser = {
  [K in keyof User]?: User[K];
};
// Equivalent to built-in Partial<T>

// Remove optional (all properties become required)
type RequiredUser = {
  [K in keyof PartialUser]-?: PartialUser[K];
};
// Equivalent to built-in Required<T>
```

## Combining with Conditional Types

Mapped types combined with conditional types enable more precise type transformations:

```typescript
// Extract only keys with function type values
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

interface Api {
  baseUrl: string;
  timeout: number;
  getUsers: () => Promise<User[]>;
  deleteUser: (id: number) => Promise<void>;
  version: string;
}

type ApiFunctionKeys = FunctionKeys<Api>;
// "getUsers" | "deleteUser"
```

## Practice: Implementing Common Utility Types

### DeepPartial — Deep Optional

The built-in `Partial` only handles the first level:

```typescript
interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepPartial<T[K]>
    : T[K];
};

const partialConfig: DeepPartial<Config> = {
  database: {
    host: "localhost",
    // port and credentials can be omitted
  },
  // cache can be omitted too
};
```

### DeepReadonly — Deep Readonly

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};

const config: DeepReadonly<Config> = getConfig();
config.database.host = "new-host"; // Error: readonly
```

### Record Implementation

```typescript
// Built-in Record<K, V>: maps union type K to value type V
type MyRecord<K extends keyof any, V> = {
  [P in K]: V;
};

type UserRoles = MyRecord<"admin" | "user" | "guest", boolean>;
// { admin: boolean; user: boolean; guest: boolean }
```

### Nullable

```typescript
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

type NullableUser = Nullable<User>;
// {
//   id: number | null
//   name: string | null
//   email: string | null
//   age: number | null
// }
```

## Summary

- Mapped types transform existing types in bulk, avoiding repetitive type declarations
- `+readonly`/`-readonly` and `+?`/`-?` control readonly and optional modifiers
- Combined with conditional types, mapped types become very powerful
- TypeScript's built-in `Partial`, `Required`, `Readonly`, `Record`, `Pick`, `Omit` are all implemented using mapped types
