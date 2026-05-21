---
title: "TypeScript 高級類型：條件類型與映射類型"
date: 2018-10-16 09:34:02
tags:
  - TypeScript
readingTime: 2
description: "學完基礎泛型後，深入研究了一下條件類型和映射類型，發現 TypeScript 的類型系統比想象中強大得多。"
wordCount: 186
---

學完基礎泛型後，深入研究了一下條件類型和映射類型，發現 TypeScript 的類型系統比想象中強大得多。

## 條件類型（Conditional Types）

```typescript
// 格式：T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// 內置的條件工具類型
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

## infer：類型推斷

```typescript
// 提取 Promise 的內部類型
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<string>; // string

// 提取函數參數類型
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

## 映射類型（Mapped Types）

遍歷現有類型的鍵，生成新類型：

```typescript
// 基礎映射
type Optional<T> = {
  [K in keyof T]?: T[K]; // 所有屬性變為可選
};

type Readonly<T> = {
  readonly [K in keyof T]: T[K]; // 所有屬性變為只讀
};

// 修改屬性類型
type Stringify<T> = {
  [K in keyof T]: string; // 所有屬性值變為 string
};

// 過濾屬性
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

interface User {
  id: number;
  name: string;
  age: number;
  email: string;
}

// 只保留 string 類型的屬性
type StringFields = PickByValue<User, string>;
// { name: string; email: string }
```

## 實用類型組合

```typescript
// 深度可選
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 深度只讀
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// 獲取函數參數的第一個參數類型
type FirstParameter<T extends (...args: any) => any> = T extends (
  first: infer F,
  ...args: any
) => any
  ? F
  : never;
```

## 模板字面量類型（TypeScript 4.1，預告）

雖然還沒發佈，但已經在提案中：

```typescript
// 未來可以這樣做（TS 4.1）
type EventName<T extends string> = `on${Capitalize<T>}`;
type Handlers = EventName<"click" | "change">; // 'onClick' | 'onChange'
```

## 實際應用：嚴格的事件類型

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
  // data 類型自動推斷為 { userId: number; name: string }
  console.log(data.userId);
});
```

## 小結

- 條件類型 `T extends U ? X : Y` 讓類型可以根據條件變化
- `infer` 在條件類型中提取未知類型
- 映射類型遍歷現有類型的鍵生成新類型
- `ReturnType`、`Parameters`、`Awaited` 等內置工具類型都是這些技術的應用
