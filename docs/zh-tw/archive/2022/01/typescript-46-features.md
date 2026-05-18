---
title: "TypeScript 4.6：控制流分析的又一次飛躍"
date: 2022-01-25 10:22:21
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.6 在 2022 年 2 月釋出，最大的亮點是控制流分析的增強——現在可以在建構函式的 super() 呼叫之前引用 this。這個看似小的改進，解決了很多實際編碼中的煩人問題。"
---

TypeScript 4.6 在 2022 年 2 月釋出，最大的亮點是控制流分析的增強——現在可以在建構函式的 super() 呼叫之前引用 this。這個看似小的改進，解決了很多實際編碼中的煩人問題。

## 建構函式中 super 前的 this

以前這樣寫會報錯：

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
    // 以前：報錯 —— super() 之前不能訪問 this
    const normalized = x.toLowerCase();
    super(normalized.length);
    this.x = x;
  }
}
```

4.6 之後不再報錯。關鍵規則：你在 super() 之前訪問的 this 不是真正的 this，只是引數傳遞——不能讀寫例項屬性，但可以呼叫方法做計算。

## 解構的控制流分析

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; sideLength: number };

function area(shape: Shape) {
  // 4.6 之前，這樣解構後 shape 的型別會丟失
  const { kind } = switch (kind) {
    // ...
  }

  // 4.6 之後，解構不會破壞控制流分析
  const { kind, ...rest } = shape;
  switch (kind) {
    case "circle":
      // rest 被正確推斷為 { radius: number }
      return Math.PI * rest.radius ** 2;
    case "square":
      // rest 被正確推斷為 { sideLength: number }
      return rest.sideLength ** 2;
  }
}
```

更好的寫法：

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

現在 TypeScript 能理解 `const { kind } = shape` 之後 shape 的型別仍然有效。

## 遞迴型別引用的深度限制

```typescript
// 以前：深度超過 50 就報錯
// 4.6：預設深度提升到 100

type DeepNest<T, N extends number> = N extends 0
  ? T
  : DeepNest<T[], Prev<N>>;

type Prev<N extends number> = N extends 1 ? 0
  : N extends 2 ? 1
  : N extends 3 ? 2
  // ... 簡化
  : never;

// 現在可以遞迴更深
type Result = DeepNest<string, 20>; // OK
```

## ES2022 的 Error Cause

```typescript
function parseConfig(json: string) {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error("配置解析失敗", { cause: e });
  }
}

try {
  parseConfig("invalid json");
} catch (e) {
  console.log(e.message);           // "配置解析失敗"
  console.log((e as Error).cause);  // SyntaxError: Unexpected token...
}
```

TypeScript 4.6 原生支援 `ErrorOptions.cause`，不需要額外的型別宣告。

## 型別引數的推斷改進

```typescript
declare function pipe<A, B, C>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C
): C;

// 4.6 之前，鏈式呼叫的型別推斷經常失敗
const result = pipe(
  "hello",
  (s) => s.length,    // A = string, 推斷 B = number
  (n) => n.toFixed(2) // B = number, 推斷 C = string
);
// result: string ✅
```

## 實際專案中的收益

```typescript
// 典型的 Express 中介軟體模式
interface Request {
  body?: unknown;
  params: Record<string, string>;
}

function validate<T>(
  handler: (req: Request & { body: T }) => void
) {
  return (req: Request) => {
    // 4.6 的控制流分析讓這裡的型別守衛生效
    if (!req.body) {
      throw new Error("Body is required");
    }
    handler(req as Request & { body: T });
  };
}

// 使用時，body 的型別自動推斷
const createUser = validate<{ name: string; email: string }>(
  (req) => {
    console.log(req.body.name);  // string ✅
    console.log(req.body.email); // string ✅
  }
);
```

## 小結

TypeScript 4.6 的改進雖然不像 4.7 那樣帶來 ESM 支援的大變革，但控制流分析的增強讓日常編碼更順暢。特別是解構不再破壞型別收窄，這個改進每天都能感受到。建議儘快升級，配合 strict 模式使用效果最佳。