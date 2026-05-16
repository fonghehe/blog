---
title: "Introduction to TypeScript Generics"
date: 2018-08-23 15:14:48
tags:
  - TypeScript
readingTime: 2
description: "TypeScript generics always seem intimidating at first, but once you get them, you'll find them incredibly useful. This post covers generics from the ground up."
---

TypeScript generics always seem intimidating at first, but once you get them, you'll find them incredibly useful. This post covers generics from the ground up.

## Why Generics

Without generics, you're forced to use `any`, losing type checking:

```typescript
// Without generics: either hardcode the type or use any
function identity(value: any): any {
  return value;
}

const result = identity("hello");
// result's type is any — the compiler doesn't know it's a string
result.toUpperCase(); // No error, even if result might not be a string
```

With generics, you get both type safety and flexibility:

```typescript
// Generics: T is a type parameter, specified at call time
function identity<T>(value: T): T {
  return value;
}

const str = identity("hello"); // T = string
str.toUpperCase(); // ✅ Compiler knows str is a string

const num = identity(42); // T = number
num.toFixed(2); // ✅ Compiler knows num is a number
```

## Basic Syntax

```typescript
// Function generics
function firstItem<T>(arr: T[]): T {
  return arr[0];
}

const first = firstItem([1, 2, 3]); // T inferred as number
const firstStr = firstItem(["a", "b"]); // T inferred as string

// Interface generics
interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

interface User {
  id: number;
  name: string;
}

function fetchUser(): Promise<ApiResponse<User>> {
  return fetch("/api/user").then((r) => r.json());
}

const response = await fetchUser();
response.data.name; // ✅ Type is string, with autocomplete
```

## Practical Application: Wrapping API Requests

```typescript
// Generic API response type
interface Response<T> {
  code: number;
  message: string;
  data: T;
}

// Generic request function
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json: Response<T> = await res.json();

  if (json.code !== 0) {
    throw new Error(json.message);
  }

  return json.data;
}

// Usage: specify T as a concrete type for full type hints
interface User {
  id: number;
  name: string;
  email: string;
}

interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
}

const user = await request<User>("/api/users/1");
user.email; // ✅ Type is string

const userList = await request<PaginatedList<User>>("/api/users");
userList.items[0].name; // ✅ Type is string
```

## Generic Constraints (extends)

Constrain a generic to require certain properties:

```typescript
// T must have a length property
function printLength<T extends { length: number }>(value: T): number {
  return value.length;
}

printLength("hello"); // ✅ string has length
printLength([1, 2, 3]); // ✅ array has length
printLength(42); // ❌ number has no length
```

```typescript
// K must be a key of T
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25, email: "alice@example.com" };

getProperty(user, "name"); // ✅ return type string
getProperty(user, "age"); // ✅ return type number
getProperty(user, "phone"); // ❌ 'phone' is not a key of user
```

## Generic Utility Types

TypeScript ships with several commonly-used generic utilities:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial: all properties become optional
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; password?: string }

// Required: all properties become required
type RequiredUser = Required<PartialUser>;

// Pick: keep only specified properties
type UserProfile = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

// Omit: exclude specified properties
type SafeUser = Omit<User, "password">;
// { id: number; name: string; email: string }

// Readonly: all properties become read-only
type ReadonlyUser = Readonly<User>;

// Record: key-value pair type
type UserMap = Record<string, User>;
// { [key: string]: User }
```

Practical usage:

```typescript
// When updating a user, only pass the changed fields
function updateUser(
  id: number,
  updates: Partial<Omit<User, "id">>,
): Promise<User> {
  return request(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

updateUser(1, { name: "Bob" }); // ✅ Only updates name
updateUser(1, { id: 2 }); // ❌ id cannot be updated (excluded by Omit)
```

## Using Generics in Vue Components

```typescript
// Generic list component
import Vue from "vue";

// Props type
interface TableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => string;
}

export default Vue.extend({
  props: {
    data: {
      type: Array as () => any[],
      required: true,
    },
    columns: {
      type: Array as () => TableColumn<any>[],
      required: true,
    },
  },
});
```

## Summary

- Generics let functions/classes/interfaces work with multiple types while remaining type-safe
- `<T extends SomeType>` constrains a generic to satisfy certain conditions
- `keyof T` gets all keys of a type; `T[K]` gets the type of a specific property
- Utility types like `Partial`, `Pick`, and `Omit` are extremely useful in everyday development
