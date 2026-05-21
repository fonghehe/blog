---
title: "TypeScript 高度な型：条件型とマップ型"
date: 2018-10-16 09:34:02
tags:
  - TypeScript
readingTime: 2
description: "基本的なジェネリクスを学んだ後、条件型とマップ型を深く調べてみると、TypeScript の型システムが想像以上に強力であることがわかりました。"
wordCount: 273
---

基本的なジェネリクスを学んだ後、条件型とマップ型を深く調べてみると、TypeScript の型システムが想像以上に強力であることがわかりました。

## 条件型（Conditional Types）

```typescript
// フォーマット：T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// 組み込みの条件ユーティリティ型
type NonNullable<T> = T extends null | undefined ? never : T;
type NonNullableStr = NonNullable<string | null>; // string

// ジェネリクス内での使用
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

## infer：型推論

```typescript
// Promise の内部型を取得
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<string>; // string

// 関数のパラメーター型を取得
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

## マップ型（Mapped Types）

既存の型のキーを走査して新しい型を生成：

```typescript
// 基本マッピング
type Optional<T> = {
  [K in keyof T]?: T[K]; // すべてのプロパティをオプションにする
};

type Readonly<T> = {
  readonly [K in keyof T]: T[K]; // すべてのプロパティを読み取り専用にする
};

// プロパティの型を変更
type Stringify<T> = {
  [K in keyof T]: string; // すべてのプロパティ値を string に変更
};

// プロパティのフィルタリング
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

interface User {
  id: number;
  name: string;
  age: number;
  email: string;
}

// string 型のプロパティのみを保持
type StringFields = PickByValue<User, string>;
// { name: string; email: string }
```

## ユーティリティ型の組み合わせ

```typescript
// 深いオプション
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 深い読み取り専用
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// 関数の最初のパラメーターの型を取得
type FirstParameter<T extends (...args: any) => any> = T extends (
  first: infer F,
  ...args: any
) => any
  ? F
  : never;
```

## テンプレートリテラル型（TypeScript 4.1 先行紹介）

まだ提案段階ですが、将来的には：

```typescript
// 将来（TS 4.1）
type EventName<T extends string> = `on${Capitalize<T>}`;
type Handlers = EventName<"click" | "change">; // 'onClick' | 'onChange'
```

## 実際の応用：厳密なイベント型

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
}
```

## まとめ

- 条件型（`T extends U ? X : Y`）は型レベルの分岐ロジックを可能にする
- `infer` は条件型の中でサブタイプをキャプチャする（例：`Promise<infer U>`）
- マップ型は `keyof T` を走査して各プロパティを変換する
- 条件型とマップ型を組み合わせることで、`DeepPartial`、`DeepReadonly`、`PickByValue` などの強力なユーティリティ型を構築できる
