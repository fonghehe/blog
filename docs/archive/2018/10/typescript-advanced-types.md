---
title: "TypeScript 高级类型：条件类型与映射类型"
date: 2018-10-16 09:34:02
tags:
  - TypeScript
readingTime: 2
description: "学完基础泛型后，深入研究了一下条件类型和映射类型，发现 TypeScript 的类型系统比想象中强大得多。"
---

学完基础泛型后，深入研究了一下条件类型和映射类型，发现 TypeScript 的类型系统比想象中强大得多。

## 条件类型（Conditional Types）

```typescript
// 格式：T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// 内置的条件工具类型
type NonNullable<T> = T extends null | undefined ? never : T;
type NonNullableStr = NonNullable<string | null>; // string

// 在泛型中使用
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function fetchUser() {
  return { id: 1, name: "Alice" };
}
type UserType = ReturnType<typeof fetchUser>;
// { id: number; name: string }
```

## infer：类型推断

```typescript
// 提取 Promise 的内部类型
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<string>; // string

// 提取函数参数类型
type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;

function greet(name: string, age: number) {
  return `${name} is ${age}`;
}
type GreetParams = Parameters<typeof greet>; // [string, number]
```

## 映射类型（Mapped Types）

遍历现有类型的键，生成新类型：

```typescript
// 基础映射
type Optional<T> = {
  [K in keyof T]?: T[K]; // 所有属性变为可选
};

type Readonly<T> = {
  readonly [K in keyof T]: T[K]; // 所有属性变为只读
};

// 修改属性类型
type Stringify<T> = {
  [K in keyof T]: string; // 所有属性值变为 string
};

// 过滤属性
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

interface User {
  id: number;
  name: string;
  age: number;
  email: string;
}

// 只保留 string 类型的属性
type StringFields = PickByValue<User, string>;
// { name: string; email: string }
```

## 实用类型组合

```typescript
// 深度可选
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 深度只读
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// 获取函数参数的第一个参数类型
type FirstParameter<T extends (...args: any) => any> = T extends (
  first: infer F,
  ...args: any
) => any
  ? F
  : never;
```

## 模板字面量类型（TypeScript 4.1，预告）

虽然还没发布，但已经在提案中：

```typescript
// 未来可以这样做（TS 4.1）
type EventName<T extends string> = `on${Capitalize<T>}`;
type Handlers = EventName<"click" | "change">; // 'onClick' | 'onChange'
```

## 实际应用：严格的事件类型

```typescript
type Events = {
  "user:login": { userId: number; name: string };
  "user:logout": void;
  "data:loaded": { items: any[]; total: number };
};

class TypedEventEmitter {
  private listeners: Partial<{
    [K in keyof Events]: ((data: Events[K]) => void)[];
  }> = {};

  on<K extends keyof Events>(event: K, callback: (data: Events[K]) => void) {
    (this.listeners[event] ||= []).push(callback as any);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners[event]?.forEach((cb) => cb(data as any));
  }
}

const emitter = new TypedEventEmitter();
emitter.on("user:login", (data) => {
  // data 类型自动推断为 { userId: number; name: string }
  console.log(data.userId);
});
```

## 小结

- 条件类型 `T extends U ? X : Y` 让类型可以根据条件变化
- `infer` 在条件类型中提取未知类型
- 映射类型遍历现有类型的键生成新类型
- `ReturnType`、`Parameters`、`Awaited` 等内置工具类型都是这些技术的应用
