---
title: "TypeScript 7.1 Decorators Metaprogramming and Type Manipulation"
date: 2026-06-09 09:22:57
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 7.1's decorators are stable, combined with new type inference capabilities, enabling powerful metaprogramming patterns. This article discusses type-safe decorator usage, common patterns, and performance considerations."
wordCount: 119
---

TypeScript decorators have evolved from experimental features to stable APIs. 2026's TypeScript 7.1 not only standardizes decorator syntax but also enhances type inference capabilities, allowing decorators to carry complete type information.

## Decorator Basics

TypeScript decorators follow TC39 Stage 3 specification:

```typescript
function log(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);

  return function (this: any, ...args: any[]) {
    console.log(`Calling ${methodName}, args:`, args);
    const result = target.call(this, ...args);
    console.log(`${methodName} returned:`, result);
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
// Output: Calling add, args: [1, 2]
// Output: add returned: 3
```

## Type-Safe Decorators

2026's best practice is to let decorators carry type information:

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
  @validate((v) => v.length >= 3, 'Username must be at least 3 characters')
  name: string = '';

  @validate((v) => v > 0 && v < 150, 'Age must be between 0-150')
  age: number = 0;
}
```

## Decorator Composition

Multiple decorators can be composed, execution order is bottom-to-top:

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

## Decorators and Interfaces

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

## Type Manipulation Practice

```typescript
// 1. Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// 2. Conditional type extraction
type ExtractReturnType<T> =
  T extends (...args: any[]) => infer R ? R : never;

// 3. Mapped type renaming
type RenameKeys<T, Mapping extends Record<string, string>> = {
  [K in keyof T as K extends keyof Mapping ? Mapping[K] : K]: T[K];
};
```

## Performance Considerations

Decorators execute at class definition time, affecting startup performance. Optimization strategies:

```typescript
// Bad practice: complex computation in decorator
function expensive(target: any, context: ClassMethodDecoratorContext) {
  const start = performance.now();
  // Complex computation...
  const duration = performance.now() - start;
  console.log(`Decorator time: ${duration}ms`);
}

// Good practice: lazy computation
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

## Summary

TypeScript 7.1's decorators provide type-safe metaprogramming capabilities. Combined with conditional types, mapped types, and infer inference, they enable declarative API design. 2026's TypeScript developers should master: decorator composition order, type-safe decorator patterns, and decorator performance impact.
