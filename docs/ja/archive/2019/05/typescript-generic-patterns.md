---
title: "TypeScriptジェネリクスプログラミングパターン詳解"
date: 2019-05-29 10:19:35
tags:
  - TypeScript
readingTime: 2
description: "ジェネリクスはTypeScriptの型システムで最も強力な機能の一つです。`Array<T>`の基本的な使い方しか知らない人が多いですが、ジェネリクスは条件型、マップ型、`infer`キーワードと組み合わせることで非常に柔軟な型推論を実現できます。本記事では基礎から実践まで、ジェネリクスプログラミングパターンを体系的に"
---

ジェネリクスはTypeScriptの型システムで最も強力な機能の一つです。`Array<T>`の基本的な使い方しか知らない人が多いですが、ジェネリクスは条件型、マップ型、`infer`キーワードと組み合わせることで非常に柔軟な型推論を実現できます。本記事では基礎から実践まで、ジェネリクスプログラミングパターンを体系的に解説します。

## ジェネリクスの基礎

ジェネリクスのコアアイデア：**型もパラメータ**です。関数が値のパラメータを受け取るように、ジェネリック関数やインターフェースは型パラメータを受け取ります。

```typescript
// ジェネリクスなし：型情報を失うか、同じコードを何度も書く
function identityNumber(arg: number): number {
  return arg;
}
function identityString(arg: string): string {
  return arg;
}
// 型ごとに関数を書くのは明らかに非合理的

// ジェネリクスを使った解決
function identity<T>(arg: T): T {
  return arg;
}

// TypeScriptがTを自動推論
const a = identity("hello"); // Tはstringに推論
const b = identity(42); // Tはnumberに推論

// 型を明示的に指定することも可能
const c = identity<string>("hello");
```

### インターフェースとクラスでのジェネリクス

```typescript
// ジェネリックインターフェース
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface User {
  id: number;
  name: string;
}

type UserResponse = ApiResponse<User>;
// 等価：{ code: number; message: string; data: User }

// ジェネリッククラス
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }
}

const numberQueue = new Queue<number>();
numberQueue.enqueue(1);
numberQueue.enqueue(2);
// numberQueue.enqueue('three'); // コンパイルエラー

const stringQueue = new Queue<string>();
```

## 制約付きジェネリクス

```typescript
// extendsでTを制約
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "アリス", age: 25 };
getProperty(user, "name"); // string
getProperty(user, "age"); // number
// getProperty(user, 'foo'); // コンパイルエラー：'foo'はuserのキーではない
```

## 条件型

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// infer：型から別の型を抽出
type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never;

function getUser() {
  return { id: 1, name: "アリス" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }

// Promiseの解決値型を抽出
type Awaited<T> = T extends Promise<infer U> ? U : T;
type Result = Awaited<Promise<string>>; // string
```

ジェネリクスをマスターすることは、再利用可能で型安全なTypeScriptを書く鍵です——型システムの真の力を解き放ちます。
