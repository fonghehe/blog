---
title: "TypeScript 5.0 裝飾器：從 Stage 2 到 Stage 3 的蜕變"
date: 2023-01-10 10:39:48
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.0 正式支持了 TC39 Stage 3 提案的裝飾器語法。這是一個等了好幾年的改動，終於可以告別 `experimentalDecorators` 了。"
wordCount: 414
---

TypeScript 5.0 正式支持了 TC39 Stage 3 提案的裝飾器語法。這是一個等了好幾年的改動，終於可以告別 `experimentalDecorators` 了。

## 新舊裝飾器的區別

舊的裝飾器（Stage 2）基於一個已經被廢棄的提案，語法和行為都和最終標準不同。TypeScript 5.0 的新裝飾器遵循 Stage 3 規範。

```typescript
// 舊寫法（experimentalDecorators）
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${key} with`, args);
    return original.apply(this, args);
  };
}

// 新寫法（Stage 3）
function log(originalMethod: any, context: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) {
    console.log(`Calling ${String(context.name)} with`, args);
    return originalMethod.apply(this, args);
  };
}
```

最大的區別是：新裝飾器接收的是一個 `context` 對象，而不是分散的 `target`、`propertyKey`、`descriptor`。這讓裝飾器的 API 更統一、更易擴展。

## 實際使用示例

### 方法裝飾器

```typescript
function retry(times: number) {
  return function (originalMethod: Function, context: ClassMethodDecoratorContext) {
    return async function (this: any, ...args: any[]) {
      for (let i = 0; i < times; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (err) {
          if (i === times - 1) throw err;
          console.log(`Retry ${i + 1}/${times} for ${String(context.name)}`);
        }
      }
    };
  };
}

class ApiService {
  @retry(3)
  async fetchData(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
```

### 自動訪問器（Auto-accessor）

這是新裝飾器引入的概念，用 `accessor` 關鍵字聲明：

```typescript
function logged(
  target: ClassAccessorDecoratorTarget<any, any>,
  context: ClassAccessorDecoratorContext,
) {
  return {
    get(this: any) {
      console.log(`Getting ${String(context.name)}`);
      return target.get.call(this);
    },
    set(this: any, value: any) {
      console.log(`Setting ${String(context.name)} to ${value}`);
      target.set.call(this, value);
    },
  } as ClassAccessorDecoratorResult<any, any>;
}

class Model {
  @logged accessor status: string = "pending";
}

const m = new Model();
m.status = "active"; // Setting status to active
console.log(m.status); // Getting status
```

## 需要注意的坑

**不兼容舊裝飾器**

新舊裝飾器不能混用。項目遷移時必須一次性全改，不能漸進式替換。`tsconfig.json` 裏需要去掉 `experimentalDecorators`。

**元數據反射不再可用**

舊裝飾器配合 `reflect-metadata` 可以做依賴注入，新裝飾器沒有 `design:type` 等元數據。需要元數據的場景（比如 Angular 的 DI）暫時還是用舊方案。

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    // 去掉這個
    // "experimentalDecorators": true,
    // "emitDecoratorMetadata": true
  }
}
```

**裝飾器順序**

方法裝飾器從下往上執行（像函數組合），和舊版的行為一致，但要注意參數裝飾器的執行時機。

## 小結

- TypeScript 5.0 裝飾器基於 TC39 Stage 3 標準，API 更統一
- `context` 對象替代了分散的參數，擴展性更好
- 引入了 `accessor` 自動訪問器概念
- 新舊裝飾器不兼容，遷移需要一次性切換
- 依賴 `reflect-metadata` 的項目暫時不適合遷移
- 推薦新項目直接使用新裝飾器語法