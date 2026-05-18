---
title: "TypeScript interface 与 type 的区别"
date: 2018-09-08 10:55:44
tags:
  - TypeScript
readingTime: 1
description: "刚学 TypeScript 时经常困惑：`interface` 和 `type` 都能定义类型，什么时候用哪个？"
---

刚学 TypeScript 时经常困惑：`interface` 和 `type` 都能定义类型，什么时候用哪个？

## 相似之处

```typescript
// interface
interface User {
  id: number;
  name: string;
}

// type alias
type User = {
  id: number;
  name: string;
};

// 两者都可以：
// - 描述对象结构
// - 可选属性 ?
// - 只读属性 readonly
// - 被 class implements
// - 互相 extends/交叉
```

## 核心区别

### 1. interface 可以声明合并（Declaration Merging）

```typescript
interface Window {
  myProp: string;
}
interface Window {
  anotherProp: number;
}
// 自动合并为：{ myProp: string; anotherProp: number }

// type 不能重复声明：
type Foo = { a: string };
type Foo = { b: number }; // ❌ 报错：重复声明
```

这对扩展全局类型（如 `Window`、`Vue`）很有用。

### 2. type 能表示更多类型

```typescript
// 联合类型（interface 做不到）
type Status = "pending" | "success" | "error";
type ID = number | string;

// 元组
type Point = [number, number];

// 条件类型（interface 做不到）
type NonNullable<T> = T extends null | undefined ? never : T;

// 映射类型（interface 可以，但 type 更常见）
type Optional<T> = { [K in keyof T]?: T[K] };

// 函数类型（两种都行，type 更简洁）
type Handler = (event: MouseEvent) => void;
interface Handler {
  (event: MouseEvent): void;
}
```

### 3. extends 语法

```typescript
// interface 继承：
interface Animal { name: string }
interface Dog extends Animal { breed: string }

// type 继承（用交叉类型）：
type Animal = { name: string }
type Dog = Animal & { breed: string }

// interface 和 type 可以互相 extends：
interface A extends type B { ... }  // ✅
type C = interface D & { ... }      // ✅（通过交叉类型）
```

## 推荐实践

**用 interface 的场景：**

- 描述对象/类的结构（语义更清晰）
- 需要声明合并时（扩展第三方类型）
- 公共 API（便于使用方扩展）

**用 type 的场景：**

- 联合类型、元组
- 工具类型（Conditional Types、Mapped Types）
- 函数类型（可读性稍好）

```typescript
// 实际项目的规范
// 描述数据结构 → interface
interface User {
  id: number;
  name: string;
}
interface ApiResponse<T> {
  code: number;
  data: T;
}

// 工具类型 → type
type Nullable<T> = T | null;
type Optional<T> = { [K in keyof T]?: T[K] };

// 联合类型 → type
type ButtonVariant = "primary" | "secondary" | "ghost";
type RequestStatus = "idle" | "loading" | "success" | "error";
```

## 小结

- `interface` 和 `type` 大多数场景可以互换
- `interface` 支持声明合并，适合描述对象结构和公共 API
- `type` 更灵活，支持联合类型、条件类型等
- 团队统一规范比纠结哪个更好更重要
