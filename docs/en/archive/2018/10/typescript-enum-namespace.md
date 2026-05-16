---
title: "TypeScript Enums and Namespaces"
date: 2018-10-21 10:31:26
tags:
  - TypeScript
readingTime: 1
description: "TypeScript enums are a must-have for developers coming from Java or C#, but there are some important nuances in TS. Namespaces are used less often but still hav"
---

TypeScript enums are a must-have for developers coming from Java or C#, but there are some important nuances in TS. Namespaces are used less often but still have the right use cases.

## Numeric Enums

```typescript
enum Direction {
  Up, // 0
  Down, // 1
  Left, // 2
  Right, // 3
}

console.log(Direction.Up); // 0
console.log(Direction[0]); // 'Up' (reverse mapping)
```

Numeric enums create a bidirectional mapping (value→name, name→value), so the compiled output is larger.

## String Enums (Recommended)

```typescript
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// Advantage: human-readable when debugging, not meaningless numbers like 0/1/2
console.log(Status.Active); // 'ACTIVE'

// Usage
function updateUser(status: Status) {
  api.patch("/user", { status });
}
updateUser(Status.Active);
```

## const enum: Compile-time Inlining

```typescript
// A regular enum compiles to an object at runtime
// const enum values are inlined at compile time (smaller bundle)
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir = Direction.Up;
// Compiled: const dir = 'UP' (inlined — no object)
```

Note: `const enum` does not support reverse mapping and cannot be used with `Object.values(Direction)`.

## Modern Alternatives to Enums

Many scenarios can use union types instead of enums:

```typescript
// Enum approach
enum Status {
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// Union type approach (more concise)
type Status = "ACTIVE" | "DISABLED";

// Or use an `as const` object (allows Object.values)
const STATUS = {
  Active: "ACTIVE",
  Disabled: "DISABLED",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'ACTIVE' | 'DISABLED'

// Get all values
Object.values(STATUS); // ['ACTIVE', 'DISABLED']
```

## Namespaces

Namespaces were used to organize code before ES6 modules became widespread. Today they're primarily useful for writing type declaration files for third-party JavaScript libraries:

```typescript
// Declare a global variable on window
declare namespace window {
  const __CONFIG__: {
    apiUrl: string;
    version: string;
  };
}

// Usage
console.log(window.__CONFIG__.apiUrl);
```

```typescript
// Writing type declarations for a global library like jQuery
declare namespace $ {
  function ajax(url: string, options?: object): Promise<any>;
  namespace fn {
    function extend(plugin: object): void;
  }
}
```

## Practical Project Recommendations

```typescript
// API status and similar: use string literal union types
type ApiStatus = "idle" | "loading" | "success" | "error";

// When you need to iterate all values: use an as const object
const ROLES = {
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const;

// When you need reverse mapping: use a regular enum
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

## Summary

- Numeric enums: have reverse mapping, but numbers are hard to read
- String enums: human-readable, recommended
- `const enum`: compile-time inlining, smaller bundle, but with limitations
- Namespaces: mainly used for global library type declarations today; use ES modules for new code
