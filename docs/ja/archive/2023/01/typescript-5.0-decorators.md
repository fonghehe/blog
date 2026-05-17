---
title: "TypeScript 5.0 デコレーター：Stage 2 から Stage 3 への進化"
date: 2023-01-10 10:39:48
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.0 正式支持了 TC39 Stage 3 提案的装饰器语法。这是一个等了好几年的改动，终于可以告别 `experimentalDecorators` 了。"
---

TypeScript 5.0 正式支持了 TC39 Stage 3 提案的装饰器语法。这是一个等了好几年的改动，终于可以告别 `experimentalDecorators` 了。

## 新旧デコレーターの違い

旧的装饰器（Stage 2）基于一个已经被废弃的提案，语法和行为都和最终标准不同。TypeScript 5.0 的新装饰器遵循 Stage 3 规范。

```typescript
// 旧写法（experimentalDecorators）
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${key} with`, args);
    return original.apply(this, args);
  };
}

// 新写法（Stage 3）
function log(originalMethod: any, context: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) {
    console.log(`Calling ${String(context.name)} with`, args);
    return originalMethod.apply(this, args);
  };
}
```

最大的区别是：新装饰器接收的是一个 `context` 对象，而不是分散的 `target`、`propertyKey`、`descriptor`。这让装饰器的 API 更统一、更易扩展。

## 実際の使用例

### 方法装饰器

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

### 自动访问器（Auto-accessor）

这是新装饰器引入的概念，用 `accessor` 关键字声明：

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

## 注意すべき落とし穴

**不兼容旧装饰器**

新旧装饰器不能混用。项目迁移时必须一次性全改，不能渐进式替换。`tsconfig.json` 里需要去掉 `experimentalDecorators`。

**元数据反射不再可用**

旧装饰器配合 `reflect-metadata` 可以做依赖注入，新装饰器没有 `design:type` 等元数据。需要元数据的场景（比如 Angular 的 DI）暂时还是用旧方案。

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    // 去掉这个
    // "experimentalDecorators": true,
    // "emitDecoratorMetadata": true
  }
}
```

**装饰器顺序**

方法装饰器从下往上执行（像函数组合），和旧版的行为一致，但要注意参数装饰器的执行时机。

## まとめ

- TypeScript 5.0 装饰器基于 TC39 Stage 3 标准，API 更统一
- `context` 对象替代了分散的参数，扩展性更好
- 引入了 `accessor` 自动访问器概念
- 新旧装饰器不兼容，迁移需要一次性切换
- 依赖 `reflect-metadata` 的项目暂时不适合迁移
- 推荐新项目直接使用新装饰器语法