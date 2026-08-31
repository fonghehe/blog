---
title: "TypeScript 4.6：制御フロー分析のまた一段の飛躍"
date: 2022-01-25 10:22:21
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.6 は2022年2月にリリースされ、最大のハイライトは制御フロー分析の強化だ——コンストラクタの super() 呼び出しの前に this を参照できるようになった。この一見小さな改善が、実際のコーディングにおける多くの厄介な問題を解決する。"
wordCount: 492
---

TypeScript 4.6 は2022年2月にリリースされ、最大のハイライトは制御フロー分析の強化だ——コンストラクタの super() 呼び出しの前に this を参照できるようになった。この一見小さな改善が、実際のコーディングにおける多くの厄介な問題を解決する。

## コンストラクタの super 前の this

以前はこのように書くとエラーが発生した：

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

4.6 以降はエラーが発生しなくなりました。重要なルール：super() 前にアクセスする this は本当の this ではなく、パラメータの受け渡しのためのものです——インスタンスプロパティの読み書きはできませんが、計算のためにメソッドを呼び出すことはできます。

## 分割代入での制御フロー分析

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

より良い書き方：

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

これで TypeScript は `const { kind } = shape` の後も shape の型が有効であることを理解できる。

## 再帰型参照の深度制限

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

## ES2022 の Error Cause

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

TypeScript 4.6 は `ErrorOptions.cause` をネイティブでサポートしており、追加の型宣言は不要だ。

## 型パラメータの推論改善

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

## 実際のプロジェクトでの恩恵

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

## まとめ

TypeScript 4.6 の改善は 4.7 のような ESM サポートの大変革をもたらすものではないが、制御フロー分析の強化により日常のコーディングがよりスムーズになる。特に分割代入が型の絞り込みを壊さなくなった点は、毎日体感できる改善だ。できるだけ早くアップグレードし、strict モードと併用することをお勧めする。