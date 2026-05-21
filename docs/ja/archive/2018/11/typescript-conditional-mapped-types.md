---
title: "TypeScript 高度な型：条件型とマップ型"
date: 2018-11-17 17:27:11
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 2.8 で条件型が、TypeScript 2.1 でマップ型が導入されました。この 2 つの機能で非常に強力な型ツールを構築できます。"
wordCount: 249
---

TypeScript 2.8 で条件型が、TypeScript 2.1 でマップ型が導入されました。この 2 つの機能で非常に強力な型ツールを構築できます。

## マップ型

既存の型から新しい型を生成する：

```typescript
// すべてのプロパティをオプションに変換
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// すべてのプロパティを読み取り専用に変換
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// すべてのプロパティを必須に変換
type Required<T> = {
  [K in keyof T]-?: T[K]; // -? はオプションマークを削除
};

// プロパティの値を別の型に変換
type Record<K extends keyof any, V> = {
  [P in K]: V;
};

// 例
interface User {
  name: string;
  age: number;
  email?: string;
}

type PartialUser = Partial<User>;
// { name?: string; age?: number; email?: string }

type UserRecord = Record<"admin" | "editor", User>;
// { admin: User; editor: User }
```

## 条件型

```typescript
// T extends U ? X : Y
// T が U に代入可能なら型は X、そうでなければ Y

type IsArray<T> = T extends any[] ? true : false;

type A = IsArray<string[]>; // true
type B = IsArray<number>; // false
```

## 組み込みユーティリティ型

```typescript
// Extract：T から U に代入可能な型を抽出
type Extract<T, U> = T extends U ? T : never;

type NumberOrString = Extract<string | number | boolean, string | number>;
// string | number

// Exclude：T から U に代入可能な型を除外
type Exclude<T, U> = T extends U ? never : T;

type NotBoolean = Exclude<string | number | boolean, boolean>;
// string | number

// ReturnType：関数の戻り値の型を取得
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : any;

function fetchUser(): Promise<{ id: number; name: string }> {
  return fetch("/api/user").then((r) => r.json());
}

type FetchResult = ReturnType<typeof fetchUser>;
// Promise<{ id: number; name: string }>
```

## infer：型推論

`infer` は条件型でサブタイプを「キャプチャ」するために使用：

```typescript
// Promise の内部型を取得
type Awaited<T> = T extends Promise<infer Inner> ? Inner : T;

type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<number[]>>; // number[]
type C = Awaited<string>; // string（Promise でない場合はそのまま）

// 配列要素の型を取得
type ArrayItem<T> = T extends (infer Item)[] ? Item : never;

type N = ArrayItem<number[]>; // number
type S = ArrayItem<string[]>; // string

// 関数の最初のパラメータの型を取得
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any
  ? F
  : never;

type P = FirstParam<(a: string, b: number) => void>; // string
```

## 実際の応用：API 型ツール

```typescript
// API レスポンス構造の定義
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// API レスポンスからデータ型を抽出
type ExtractData<T> = T extends ApiResponse<infer D> ? D : never;

// API 関数の定義
async function getUserList(): Promise<ApiResponse<User[]>> {
  const res = await fetch("/api/users");
  return res.json();
}

// UserList = User[] と推論
type UserList = ExtractData<Awaited<ReturnType<typeof getUserList>>>;
```

## Omit：指定したプロパティを削除

```typescript
// TS 3.5 組み込み。自分で実装：
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

interface User {
  id: number;
  name: string;
  password: string;
  createdAt: Date;
}

// 機密フィールドを削除
type PublicUser = Omit<User, "password" | "createdAt">;
// { id: number; name: string }
```

## まとめ

- マップ型：`[K in keyof T]` でプロパティを反復して新しい型を生成
- 条件型：`T extends U ? X : Y` で条件に応じて型を選択
- `infer`：条件型でサブタイプを推論
- `Partial/Required/Readonly/Record/Omit/Extract/Exclude`：組み込みユーティリティ型
- これらの機能で型安全なユーティリティ関数を構築し、型定義の重複を削減できる
