---
title: "TypeScript 4.6: Another Leap in Control Flow Analysis"
date: 2022-01-25 10:22:21
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.6 shipped in February 2022, and its highlight is improved control flow analysis — you can now reference this before the super() call in constructors. This seemingly small improvement fixes a lot of annoying problems in real code."
wordCount: 199
---

TypeScript 4.6 was released in February 2022, and its biggest highlight is enhanced control flow analysis—you can now reference `this` before the `super()` call in a constructor. This seemingly small improvement resolves many annoying issues in everyday coding.

## this Before super in Constructor

Previously, this would throw an error:

```typescript
class Base {
  x: number;
  constructor(x: number) {
    this.x = x;
  }
}

class Derived extends Base {
  x: string;

  constructor(x: string) {
    // 以前：报错 —— super() 之前不能访问 this
    const normalized = x.toLowerCase();
    super(normalized.length);
    this.x = x;
  }
}
```

After 4.6, this no longer causes an error. The key rule: the this you access before super() is not the real this — it is just for parameter passing. You cannot read or write instance properties, but you can call methods for computation.

## Control Flow Analysis with Destructuring

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number };

function area(shape: Shape) {
  // 4.6 之前，这样解构后 shape 的类型会丢失
  const { kind } = switch (kind) {
    // ...
  }

  // 4.6 之后，解构不会破坏控制流分析
  const { kind, ...rest } = shape;
  switch (kind) {
    case "circle":
      // rest 被正确推断为 { radius: number }
      return Math.PI * rest.radius ** 2;
    case "square":
      // rest 被正确推断为 { sideLength: number }
      return rest.sideLength ** 2;
  }
}
```

A better approach:

```typescript
function area(shape: Shape) {
  const { kind } = shape;
  switch (kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.sideLength ** 2;
  }
}
```

TypeScript now understands that the type of `shape` remains valid after `const { kind } = shape`.

## Depth Limit for Recursive Type References

```typescript
// 以前：深度超过 50 就报错
// 4.6：默认深度提升到 100

type DeepNest<T, N extends number> = N extends 0
  ? T
  : DeepNest<T[], Prev<N>>;

type Prev<N extends number> = N extends 1 ? 0
  : N extends 2 ? 1
  : N extends 3 ? 2
  // ... 简化
  : never;

// 现在可以递归更深
type Result = DeepNest<string, 20>; // OK
```

## ES2022 Error Cause

```typescript
function parseConfig(json: string) {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error("配置解析失败", { cause: e });
  }
}

try {
  parseConfig("invalid json");
} catch (e) {
  console.log(e.message);           // "配置解析失败"
  console.log((e as Error).cause);  // SyntaxError: Unexpected token...
}
```

TypeScript 4.6 natively supports `ErrorOptions.cause`, with no extra type declarations needed.

## Improved Type Parameter Inference

```typescript
declare function pipe<A, B, C>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C
): C;

// 4.6 之前，链式调用的类型推断经常失败
const result = pipe(
  "hello",
  (s) => s.length,    // A = string, 推断 B = number
  (n) => n.toFixed(2) // B = number, 推断 C = string
);
// result: string ✅
```

## Benefits in Real Projects

```typescript
// 典型的 Express 中间件模式
interface Request {
  body?: unknown;
  params: Record<string, string>;
}

function validate<T>(
  handler: (req: Request & { body: T }) => void
) {
  return (req: Request) => {
    // 4.6 的控制流分析让这里的类型守卫生效
    if (!req.body) {
      throw new Error("Body is required");
    }
    handler(req as Request & { body: T });
  };
}

// 使用时，body 的类型自动推断
const createUser = validate<{ name: string; email: string }>(
  (req) => {
    console.log(req.body.name);  // string ✅
    console.log(req.body.email); // string ✅
  }
);
```

## Summary

Although TypeScript 4.6's improvements don't bring the kind of major shift that ESM support did in 4.7, the enhanced control flow analysis makes everyday coding smoother. In particular, destructuring no longer breaks type narrowing—a fix you'll feel every day. It's worth upgrading soon; using it together with strict mode yields the best results.