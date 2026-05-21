---
title: "TypeScript マップ型の深い理解"
date: 2019-07-25 16:35:13
tags:
  - TypeScript
readingTime: 2
description: "TypeScript の型システムは非常に強力で、マップ型（Mapped Types）はその中でも最も実用的な機能の一つです。既存の型を基に新しい型を作成し、プロパティの修飾子を一括変更できます。この記事では基礎から実践まで、マップ型を詳しく解説します。"
wordCount: 405
---

TypeScript の型システムは非常に強力で、マップ型（Mapped Types）はその中でも最も実用的な機能の一つです。既存の型を基に新しい型を作成し、プロパティの修飾子を一括変更できます。この記事では基礎から実践まで、マップ型を詳しく解説します。

## 基本構文

マップ型のコア構文：

```typescript
type MappedType<T> = {
  [K in keyof T]: T[K];
};
```

- `keyof T`：T の全キーをユニオン型として取得
- `K in keyof T`：各キーを繰り返す
- `T[K]`：T の キー K に対応する型を取得（インデックスアクセス型）

シンプルな例：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

// 全プロパティを string 型に変換
type StringifyUser = {
  [K in keyof User]: string;
};
```

## readonly 修飾子：readonly +/-

`+` は修飾子を追加（デフォルト、省略可能）、`-` は削除します：

```typescript
// readonly を追加（全プロパティが読み取り専用に）
type ReadonlyUser = {
  readonly [K in keyof User]: User[K];
};

// readonly を削除
type MutableUser = {
  -readonly [K in keyof ReadonlyUser]: ReadonlyUser[K];
};
```

## オプショナル修飾子：? +/-

```typescript
// 全プロパティをオプショナルに
type PartialUser = {
  [K in keyof User]?: User[K];
};
// 組み込みの Partial<T> と同等

// オプショナルを削除（全プロパティが必須に）
type RequiredUser = {
  [K in keyof PartialUser]-?: PartialUser[K];
};
// 組み込みの Required<T> と同等
```

## 条件型との組み合わせ

マップ型と条件型を組み合わせると、より精密な型変換ができます：

```typescript
// 関数型のプロパティのキーのみを抽出
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type ApiFunctionKeys = FunctionKeys<Api>;
// "getUsers" | "deleteUser"
```

## 実践：よく使うユーティリティ型の実装

### DeepPartial — ディープ オプショナル

組み込みの `Partial` は第1レベルのみ処理します：

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepPartial<T[K]>
    : T[K];
};

const partialConfig: DeepPartial<Config> = {
  database: {
    host: "localhost",
    // port と credentials は省略可能
  },
};
```

### DeepReadonly — ディープ 読み取り専用

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};
```

## まとめ

- マップ型は既存の型を一括変換し、繰り返しの型宣言を避けられる
- `+readonly`/`-readonly` と `+?`/`-?` で修飾子を制御できる
- 条件型と組み合わせると非常に強力になる
- TypeScript の組み込み `Partial`、`Required`、`Readonly`、`Record`、`Pick`、`Omit` は全てマップ型で実装されている
