---
title: "TypeScript interface と type の違い"
date: 2018-09-08 10:55:44
tags:
  - TypeScript
readingTime: 2
description: "TypeScript を学び始めた頃、よく迷っていました：`interface` と `type` はどちらも型を定義できますが、どちらをいつ使えばよいのでしょうか？"
---

TypeScript を学び始めた頃、よく迷っていました：`interface` と `type` はどちらも型を定義できますが、どちらをいつ使えばよいのでしょうか？

## 共通点

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

// どちらも可能：
// - オブジェクト構造の記述
// - オプショナルプロパティ ?
// - 読み取り専用プロパティ readonly
// - class による implements
// - 互いの extends/交差
```

## 主な違い

### 1. interface は宣言のマージ（Declaration Merging）ができる

```typescript
interface Window {
  myProp: string;
}
interface Window {
  anotherProp: number;
}
// 自動的にマージされる：{ myProp: string; anotherProp: number }

// type は重複宣言できない：
type Foo = { a: string };
type Foo = { b: number }; // ❌ エラー：重複宣言
```

これはグローバル型（`Window`、`Vue` など）を拡張する際に便利です。

### 2. type はより多くの型を表現できる

```typescript
// ユニオン型（interface ではできない）
type Status = "pending" | "success" | "error";
type ID = number | string;

// タプル
type Point = [number, number];

// 条件型（interface ではできない）
type NonNullable<T> = T extends null | undefined ? never : T;

// マップ型（interface でも可能だが、type がより一般的）
type Optional<T> = { [K in keyof T]?: T[K] };

// 関数型（どちらでも可能。type の方が簡潔）
type Handler = (event: MouseEvent) => void;
interface Handler {
  (event: MouseEvent): void;
}
```

### 3. extends の構文

```typescript
// interface の継承：
interface Animal { name: string }
interface Dog extends Animal { breed: string }

// type の継承（交差型を使用）：
type Animal = { name: string }
type Dog = Animal & { breed: string }

// interface と type は互いに extends できる：
interface A extends type B { ... }  // ✅
type C = interface D & { ... }      // ✅（交差型を通じて）
```

## 推奨する使い分け

**interface を使う場面：**

- オブジェクト/クラスの構造を記述する（意味が明確）
- 宣言のマージが必要な場合（サードパーティの型を拡張する）
- 公開 API（使用者が拡張できるように）

**type を使う場面：**

- ユニオン型、タプル
- ユーティリティ型（Conditional Types、Mapped Types）
- 関数型（やや可読性が高い）

```typescript
// 実際のプロジェクトでの規則
// データ構造の記述 → interface
interface User {
  id: number;
  name: string;
}
interface ApiResponse<T> {
  code: number;
  data: T;
}

// ユーティリティ型 → type
type Nullable<T> = T | null;
type Optional<T> = { [K in keyof T]?: T[K] };

// ユニオン型 → type
type ButtonVariant = "primary" | "secondary" | "ghost";
type RequestStatus = "idle" | "loading" | "success" | "error";
```

## まとめ

- `interface` と `type` はほとんどの場面で互換性がある
- `interface` は宣言のマージをサポートし、オブジェクト構造や公開 API の記述に向いている
- `type` はより柔軟で、ユニオン型・条件型などをサポートする
- どちらが優れているかにこだわるより、チームで規則を統一する方が重要
