---
title: "TypeScript 枚举和命名空间"
date: 2018-10-21 10:31:26
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 的枚举（enum）是很多人从 Java/C# 来的必用特性，但在 TS 里有一些值得注意的地方。命名空间（namespace）用的少，但也有合适的场景。"
wordCount: 274
---

TypeScript 的枚举（enum）是很多人从 Java/C# 来的必用特性，但在 TS 里有一些值得注意的地方。命名空间（namespace）用的少，但也有合适的场景。

## 数字枚举

```typescript
enum Direction {
  Up, // 0
  Down, // 1
  Left, // 2
  Right, // 3
}

console.log(Direction.Up); // 0
console.log(Direction[0]); // 'Up'（反向映射）
```

数字枚举会双向映射（值→名称，名称→值），所以编译后的代码量较多。

## 字符串枚举（更推荐）

```typescript
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 优点：调试时可读，不是 0/1/2 这种无意义数字
console.log(Status.Active); // 'ACTIVE'

// 使用
function updateUser(status: Status) {
  api.patch("/user", { status });
}
updateUser(Status.Active);
```

## const enum：编译时内联

```typescript
// 普通 enum 编译后会生成对象
// const enum 会被内联替换（更小的 bundle）
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir = Direction.Up;
// 编译后：const dir = 'UP'（直接替换，没有对象）
```

注意：`const enum` 不支持反向映射，也不能用 `Object.values(Direction)`。

## 枚举的替代方案（更现代）

很多场景可以用联合类型代替枚举：

```typescript
// 枚举写法
enum Status {
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 联合类型写法（更简洁）
type Status = "ACTIVE" | "DISABLED";

// 或者用 as const 对象（可以 Object.values）
const STATUS = {
  Active: "ACTIVE",
  Disabled: "DISABLED",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'ACTIVE' | 'DISABLED'

// 获取所有值
Object.values(STATUS); // ['ACTIVE', 'DISABLED']
```

## 命名空间

命名空间在 ES6 模块化普及之前用于组织代码，现在主要用于给第三方 JS 库写声明文件：

```typescript
// 声明 window 上的全局变量
declare namespace window {
  const __CONFIG__: {
    apiUrl: string;
    version: string;
  };
}

// 使用
console.log(window.__CONFIG__.apiUrl);
```

```typescript
// 给 jQuery 这类全局库写类型声明
declare namespace $ {
  function ajax(url: string, options?: object): Promise<any>;
  namespace fn {
    function extend(plugin: object): void;
  }
}
```

## 实际项目建议

```typescript
// 接口状态等：用字符串字面量联合类型
type ApiStatus = "idle" | "loading" | "success" | "error";

// 需要迭代所有值时：用 as const 对象
const ROLES = {
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const;

// 需要反向映射时：用普通 enum
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

## 小结

- 数字枚举：有反向映射，但数字可读性差
- 字符串枚举：可读性好，推荐用
- `const enum`：编译时内联，更小的 bundle，但功能有限制
- 现代替代：联合类型或 `as const` 对象，更灵活
- 命名空间：主要用于声明文件，业务代码用 ES module
