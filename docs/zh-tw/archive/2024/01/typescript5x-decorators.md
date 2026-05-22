---
title: "TypeScript 5.x 裝飾器正式版"
date: 2024-01-28 15:09:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.0 釋出了正式的裝飾器標準（TC39 Stage 3），和之前實驗性裝飾器（`experimentalDecorators`）有幾處重要區別。"
wordCount: 179
---

TypeScript 5.0 釋出了正式的裝飾器標準（TC39 Stage 3），和之前實驗性裝飾器（`experimentalDecorators`）有幾處重要區別。

## 新舊裝飾器對比

```typescript
// 舊版（experimentalDecorators: true）
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`呼叫 ${key}`);
    return original.apply(this, args);
  };
  return descriptor;
}

// 新版（Stage 3，TypeScript 5.0+）
function log<This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
) {
  return function (this: This, ...args: Args): Return {
    console.log(`呼叫 ${String(context.name)}`);
    return target.call(this, ...args);
  };
}
```

## 類裝飾器

```typescript
// 給類新增單例模式
function singleton<T extends { new (...args: any[]): {} }>(
  target: T,
  context: ClassDecoratorContext,
) {
  let instance: InstanceType<T>;

  return function (...args: ConstructorParameters<T>) {
    if (!instance) {
      instance = new target(...args) as InstanceType<T>;
    }
    return instance;
  } as unknown as T;
}

@singleton
class Database {
  private connection: string;

  constructor(url: string) {
    this.connection = url;
    console.log("建立資料庫連線");
  }
}

const db1 = new Database("postgresql://localhost/mydb");
const db2 = new Database("postgresql://localhost/other");
console.log(db1 === db2); // true（單例）
```

## 方法裝飾器：自動 memoize

```typescript
function memoize<This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
) {
  const cache = new Map<string, Return>();

  return function (this: This, ...args: Args): Return {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = target.call(this, ...args);
    cache.set(key, result);
    return result;
  };
}

class Calculator {
  @memoize
  fibonacci(n: number): number {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }
}
```

## 訪問器裝飾器：computed properties

```typescript
function observable(
  target: ClassAccessorDecoratorTarget<unknown, unknown>,
  context: ClassAccessorDecoratorContext,
) {
  return {
    get(this: any) {
      return target.get.call(this);
    },
    set(this: any, value: unknown) {
      const oldValue = target.get.call(this);
      target.set.call(this, value);

      if (oldValue !== value) {
        console.log(`${String(context.name)} 從 ${oldValue} 變為 ${value}`);
        this._notify?.(context.name, value);
      }
    },
  };
}

class User {
  @observable
  accessor name: string = "";

  @observable
  accessor age: number = 0;
}

const user = new User();
user.name = "張三"; // 列印：name 從  變為 張三
user.age = 25; // 列印：age 從 0 變為 25
```

## 遷移注意事項

```json
// tsconfig.json
{
  "compilerOptions": {
    // 新裝飾器（Stage 3）：不需要任何額外設定
    // 舊裝飾器：需要這個選項
    // "experimentalDecorators": true
  }
}
```

兩套裝飾器**不相容**。如果你用了 `class-validator`、`typeorm`、`reflect-metadata`，這些庫還依賴舊裝飾器，暫時不要遷移。

## TypeScript 5.x 其他重要特性

```typescript
// 5.4：NoInfer 工具型別
function createPair<T>(first: T, second: NoInfer<T>): [T, T] {
  return [first, second];
}
createPair("hello", "world"); // OK
createPair("hello", 42); // 錯誤！42 不是 string

// 5.2：using 語句（Stage 3 Explicit Resource Management）
async function processFile() {
  await using file = await openFile("data.txt");
  // 函式結束時自動呼叫 file[Symbol.asyncDispose]()
  return file.read();
}
```

## 小結

- TypeScript 5.x 裝飾器已經是正式標準，不再是實驗性特性
- 新舊裝飾器不相容，遷移前確認依賴庫支援情況
- `NoInfer<T>` 解決了長期以來的推斷歧義問題
- `using` 語句讓資源管理更安全、更優雅