---
title: "TypeScript 7.1 デコレータメタプログラミングと型操作"
date: 2026-06-09 09:22:57
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 7.1 のデコレータは安定し、新しい型推論能力と組み合わせて強力なメタプログラミングパターンを実現可能にした。型安全なデコレータの使用法、よくあるパターン、パフォーマンス検討を議論する。"
wordCount: 369
---

TypeScript のデコレータは実験的機能から安定した API に進化した。2026 年の TypeScript 7.1 はデコレータ構文を標準化するだけでなく、型推論能力も強化し、デコレータが完全な型情報を保持できるようにした。

## デコレータの基礎

TypeScript のデコレータは TC39 Stage 3 仕様に準拠：

```typescript
function log(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  return function (this: any, ...args: any[]) {
    console.log(`${methodName} を呼び出し、引数:`, args);
    const result = target.call(this, ...args);
    console.log(`${methodName} 戻り値:`, result);
    return result;
  };
}

class Calculator {
  @log
  add(a: number, b: number): number {
    return a + b;
  }
}

new Calculator().add(1, 2);
// 出力: add を呼び出し、引数: [1, 2]
// 出力: add 戻り値: 3
```

## 型安全なデコレータ

2026 年のベストプラクティスはデコレータに型情報を持たせること：

```typescript
function validate<T>(
  schema: (value: T) => boolean,
  message: string
) {
  return function (
    target: any,
    context: ClassFieldDecoratorContext
  ) {
    const fieldName = String(context.name);

    return function (this: any, initialValue: T) {
      if (!schema(initialValue)) {
        throw new Error(`${fieldName}: ${message}`);
      }
      return initialValue;
    };
  };
}

class User {
  @validate((v) => v.length >= 3, 'ユーザー名は3文字以上必要です')
  name: string = '';

  @validate((v) => v > 0 && v < 150, '年齢は0-150の間でなければなりません')
  age: number = 0;
}
```

## デコレータの組み合わせ

複数のデコレータを組み合わせでき、実行順序は下から上：

```typescript
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

function readonly(target: any, context: ClassMethodDecoratorContext) {
  context.addInitializer(function () {
    Object.defineProperty(this, context.name, {
      writable: false,
      configurable: false
    });
  });
}

@sealed
class BugReport {
  title: string;

  @readonly
  getVersion(): string {
    return '1.0';
  }
}
```

## デコレータとインターフェース

```typescript
interface RouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
}

function route(config: RouteConfig) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    const handler = target;
    const methodName = String(context.name);

    if (!target.constructor._routes) {
      target.constructor._routes = [];
    }
    target.constructor._routes.push({
      method: config.method,
      path: config.path,
      handler,
      methodName
    });
  };
}

class UserController {
  @route({ method: 'GET', path: '/users' })
  list() {
    return [{ id: 1, name: 'Alice' }];
  }

  @route({ method: 'POST', path: '/users' })
  create(data: any) {
    return { id: 2, ...data };
  }
}
```

## 型操作の実践

```typescript
// 1. 深い読み取り専用
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// 2. 条件型による抽出
type ExtractReturnType<T> =
  T extends (...args: any[]) => infer R ? R : never;

// 3. マッピング型による名前変更
type RenameKeys<T, Mapping extends Record<string, string>> = {
  [K in keyof T as K extends keyof Mapping ? Mapping[K] : K]: T[K];
};
```

## パフォーマンス検討

デコレータはクラス定義時に実行され、起動パフォーマンスに影響する：

```typescript
// 悪い例：デコレータ内で複雑な計算
function expensive(target: any, context: ClassMethodDecoratorContext) {
  const start = performance.now();
  // 複雑な計算...
  const duration = performance.now() - start;
  console.log(`デコレータ時間: ${duration}ms`);
}

// 良い例：遅延計算
function lazy(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  let cached: any;

  return function (this: any, ...args: any[]) {
    if (cached === undefined) {
      cached = expensiveComputation(this, methodName);
    }
    return cached;
  };
}
```

## まとめ

TypeScript 7.1 のデコレータは型安全なメタプログラミング能力を提供する。条件型、マッピング型、infer 推論と組み合わせることで、宣言的な API 設計を実現できる。2026 年の TypeScript 開発者は：デコレータの組み合わせ順序、型安全なデコレータパターン、デコレータのパフォーマンス影響を習得すべきだ。
