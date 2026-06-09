---
title: "TypeScript 7.1 裝飾器元編程與類型體操"
date: 2026-06-09 09:22:57
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 7.1 的裝飾器已經穩定，配合新的類型推導能力，可以實現強大的元編程模式。本文討論裝飾器的類型安全用法、常見模式和性能考量。"
wordCount: 247
---

TypeScript 的裝飾器從實驗特性變成了穩定 API。2026 年的 TypeScript 7.1 不僅讓裝飾器語法標準化，還增強了類型推導能力，讓裝飾器可以攜帶完整的類型信息。

## 裝飾器基礎

TypeScript 的裝飾器遵循 TC39 Stage 3 規範：

```typescript
function log(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  return function (this: any, ...args: any[]) {
    console.log(`調用 ${methodName}，參數:`, args);
    const result = target.call(this, ...args);
    console.log(`${methodName} 返回:`, result);
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
// 輸出: 調用 add，參數: [1, 2]
// 輸出: add 返回: 3
```

## 類型安全的裝飾器

2026 年的最佳實踐是讓裝飾器攜帶類型信息：

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
  @validate((v) => v.length >= 3, '用戶名至少3個字符')
  name: string = '';

  @validate((v) => v > 0 && v < 150, '年齡必須在0-150之間')
  age: number = 0;
}
```

## 裝飾器組合

多個裝飾器可以組合使用，執行順序從下到上：

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

## 類型體操實戰

```typescript
// 1. 深度只讀
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// 2. 條件類型提取
type ExtractReturnType<T> =
  T extends (...args: any[]) => infer R ? R : never;

// 3. 映射類型重命名
type RenameKeys<T, Mapping extends Record<string, string>> = {
  [K in keyof T as K extends keyof Mapping ? Mapping[K] : K]: T[K];
};
```

## 性能考量

裝飾器會在類定義時執行，影響啟動性能。優化策略：

```typescript
// 不好的做法：裝飾器內做複雜計算
function expensive(target: any, context: ClassMethodDecoratorContext) {
  const start = performance.now();
  // 複雜計算...
  const duration = performance.now() - start;
  console.log(`裝飾器耗時: ${duration}ms`);
}

// 好的做法：延遲計算
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

## 總結

TypeScript 7.1 的裝飾器提供了類型安全的元編程能力。配合條件類型、映射類型和 infer 推導，可以實現聲明式的 API 設計。2026 年的 TypeScript 開發者應該掌握：裝飾器的組合順序、類型安全的裝飾器模式、以及裝飾器的性能影響。
