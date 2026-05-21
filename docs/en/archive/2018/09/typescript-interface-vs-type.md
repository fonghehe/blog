---
title: "TypeScript: interface vs type"
date: 2018-09-08 10:55:44
tags:
  - TypeScript
readingTime: 1
description: "When learning TypeScript, it's easy to wonder: both `interface` and `type` can define types — which one should you use?"
wordCount: 89
---

When learning TypeScript, it's easy to wonder: both `interface` and `type` can define types — which one should you use?

## Similarities

```typescript
// interface
interface User {
  id: number;
  name: string;
}

// type alias
type User = {
  id: number;
  name: string;
};

// Both can:
// - Describe object structures
// - Optional properties with ?
// - Readonly properties
// - Be implemented by classes
// - Extend/intersect with each other
```

## Key Differences

### 1. interface Supports Declaration Merging

```typescript
interface Window {
  myProp: string;
}
interface Window {
  anotherProp: number;
}
// Automatically merged: { myProp: string; anotherProp: number }

// type cannot be redeclared:
type Foo = { a: string };
type Foo = { b: number }; // ❌ Error: duplicate identifier
```

This is useful for extending global types (like `Window` or `Vue`).

### 2. type Can Represent More Type Forms

```typescript
// Union types (interface can't)
type Status = "pending" | "success" | "error";
type ID = number | string;

// Tuples
type Point = [number, number];

// Conditional types (interface can't)
type NonNullable<T> = T extends null | undefined ? never : T;

// Mapped types (both work, but type is more common)
type Optional<T> = { [K in keyof T]?: T[K] };

// Function types (both work; type is slightly more concise)
type Handler = (event: MouseEvent) => void;
interface Handler {
  (event: MouseEvent): void;
}
```

### 3. extends Syntax

```typescript
// interface inheritance:
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}

// type inheritance (via intersection):
type Animal = { name: string };
type Dog = Animal & { breed: string };

// interface and type can extend each other:
// interface A extends TypeB { ... }  // ✅
// type C = InterfaceD & { ... }       // ✅ (via intersection)
```

## Recommended Practices

**Use interface when:**

- Describing object/class structure (clearer semantics)
- Declaration merging is needed (extending third-party types)
- Public APIs (consumers can extend them)

**Use type when:**

- Union types, tuples
- Utility types (Conditional Types, Mapped Types)
- Function types (slightly more readable)

```typescript
// Project conventions in practice
// Describing data structures → interface
interface User {
  id: number;
  name: string;
}
interface ApiResponse<T> {
  code: number;
  data: T;
}

// Utility types → type
type Nullable<T> = T | null;
type Optional<T> = { [K in keyof T]?: T[K] };
```
