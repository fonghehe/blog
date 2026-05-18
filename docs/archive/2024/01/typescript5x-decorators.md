---
title: "TypeScript 5.x 装饰器正式版"
date: 2024-01-28 15:09:50
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.0 发布了正式的装饰器标准（TC39 Stage 3），和之前实验性装饰器（`experimentalDecorators`）有几处重要区别。"
---

TypeScript 5.0 发布了正式的装饰器标准（TC39 Stage 3），和之前实验性装饰器（`experimentalDecorators`）有几处重要区别。

## 新旧装饰器对比

```typescript
// 旧版（experimentalDecorators: true）
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`调用 ${key}`);
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
    console.log(`调用 ${String(context.name)}`);
    return target.call(this, ...args);
  };
}
```

## 类装饰器

```typescript
// 给类添加单例模式
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
    console.log("创建数据库连接");
  }
}

const db1 = new Database("postgresql://localhost/mydb");
const db2 = new Database("postgresql://localhost/other");
console.log(db1 === db2); // true（单例）
```

## 方法装饰器：自动 memoize

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

## 访问器装饰器：computed properties

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
        console.log(`${String(context.name)} 从 ${oldValue} 变为 ${value}`);
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
user.name = "张三"; // 打印：name 从  变为 张三
user.age = 25; // 打印：age 从 0 变为 25
```

## 迁移注意事项

```json
// tsconfig.json
{
  "compilerOptions": {
    // 新装饰器（Stage 3）：不需要任何额外配置
    // 旧装饰器：需要这个选项
    // "experimentalDecorators": true
  }
}
```

两套装饰器**不兼容**。如果你用了 `class-validator`、`typeorm`、`reflect-metadata`，这些库还依赖旧装饰器，暂时不要迁移。

## TypeScript 5.x 其他重要特性

```typescript
// 5.4：NoInfer 工具类型
function createPair<T>(first: T, second: NoInfer<T>): [T, T] {
  return [first, second];
}
createPair("hello", "world"); // OK
createPair("hello", 42); // 错误！42 不是 string

// 5.2：using 语句（Stage 3 Explicit Resource Management）
async function processFile() {
  await using file = await openFile("data.txt");
  // 函数结束时自动调用 file[Symbol.asyncDispose]()
  return file.read();
}
```

## 小结

- TypeScript 5.x 装饰器已经是正式标准，不再是实验性特性
- 新旧装饰器不兼容，迁移前确认依赖库支持情况
- `NoInfer<T>` 解决了长期以来的推断歧义问题
- `using` 语句让资源管理更安全、更优雅