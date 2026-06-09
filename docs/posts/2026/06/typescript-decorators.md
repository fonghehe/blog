---
title: "TypeScript 7.1 装饰器元编程与类型体操"
date: 2026-06-09 09:22:57
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 7.1 的装饰器已经稳定，配合新的类型推导能力，可以实现强大的元编程模式。本文讨论装饰器的类型安全用法、常见模式和性能考量。"
wordCount: 446
---

TypeScript 的装饰器从实验特性变成了稳定 API。2026 年的 TypeScript 7.1 不仅让装饰器语法标准化，还增强了类型推导能力，让装饰器可以携带完整的类型信息。

## 装饰器基础

TypeScript 的装饰器遵循 TC39 Stage 3 规范：

```typescript
function log(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  return function (this: any, ...args: any[]) {
    console.log(`调用 ${methodName}，参数:`, args);
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
// 输出: 调用 add，参数: [1, 2]
// 输出: add 返回: 3
```

装饰器的参数：
- `target`：被装饰的方法本身
- `context`：包含方法名、静态性、私有性等元信息

## 类型安全的装饰器

2026 年的最佳实践是让装饰器携带类型信息：

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
  @validate((v) => v.length >= 3, '用户名至少3个字符')
  name: string = '';

  @validate((v) => v > 0 && v < 150, '年龄必须在0-150之间')
  age: number = 0;
}
```

这个模式让装饰器可以接收泛型参数，同时保持类型安全。

## 装饰器组合

多个装饰器可以组合使用，执行顺序从下到上：

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

组合的执行顺序：
1. `@readonly` 先执行（下到上）
2. `@sealed` 后执行

## 装饰器与接口

装饰器可以与接口结合，实现声明式 API：

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

    // 存储路由信息
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

## 类型体操实战

TypeScript 的类型系统可以做到很多"看起来不可能"的事情：

```typescript
// 1. 深度只读
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// 2. 条件类型提取
type ExtractReturnType<T> =
  T extends (...args: any[]) => infer R ? R : never;

// 3. 映射类型重命名
type RenameKeys<T, Mapping extends Record<string, string>> = {
  [K in keyof T as K extends keyof Mapping ? Mapping[K] : K]: T[K];
};

// 使用
interface User {
  firstName: string;
  lastName: string;
  age: number;
}

type APIUser = RenameKeys<User, {
  firstName: 'first_name';
  lastName: 'last_name';
}>;
// { first_name: string; last_name: string; age: number }
```

## 装饰器的性能考量

装饰器会在类定义时执行，影响启动性能。优化策略：

```typescript
// 不好的做法：装饰器内做复杂计算
function expensive(target: any, context: ClassMethodDecoratorContext) {
  const start = performance.now();
  // 复杂计算...
  const duration = performance.now() - start;
  console.log(`装饰器耗时: ${duration}ms`);
}

// 好的做法：延迟计算
function lazy(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  let cached: any;

  return function (this: any, ...args: any[]) {
    if (cached === undefined) {
      // 首次调用时才计算
      cached = expensiveComputation(this, methodName);
    }
    return cached;
  };
}
```

## 装饰器与元数据

TypeScript 装饰器可以与 reflect-metadata 配合，实现依赖注入等模式：

```typescript
import 'reflect-metadata';

function inject(token: string) {
  return function (
    target: any,
    context: ClassFieldDecoratorContext
  ) {
    Reflect.defineMetadata('inject:token', token, target, context.name);
  };
}

class UserService {
  @inject('api.url')
  apiUrl!: string;

  @inject('auth.token')
  authToken!: string;
}

// 读取元数据
const tokens = Reflect.getMetadataKeys(
  UserService.prototype,
  'apiUrl'
);
```

## 实际应用：日志装饰器

一个生产级的日志装饰器：

```typescript
type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel = 'info') {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    const methodName = String(context.name);
    const original = target;

    return function (this: any, ...args: any[]) {
      const start = performance.now();
      try {
        const result = original.call(this, ...args);
        const duration = performance.now() - start;

        console[level](`[${methodName}]`, {
          args,
          duration: `${duration.toFixed(2)}ms`,
          result
        });

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`[${methodName}] 错误`, {
          args,
          duration: `${duration.toFixed(2)}ms`,
          error
        });
        throw error;
      }
    };
  };
}
```

## 小结

TypeScript 7.1 的装饰器提供了类型安全的元编程能力。配合条件类型、映射类型和 infer 推导，可以实现声明式的 API 设计。2026 年的 TypeScript 开发者应该掌握：装饰器的组合顺序、类型安全的装饰器模式、以及装饰器的性能影响。装饰器不是魔法，而是利用 TypeScript 类型系统的一种方式。
