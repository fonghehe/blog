---
title: "TypeScript 3.x 新機能まとめ"
date: 2019-01-12 16:10:42
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.0から3.3まで次々とリリースされ、多くの実用的な機能が追加された。まとめておこう。"
wordCount: 104
---

TypeScript 3.0から3.3まで次々とリリースされ、多くの実用的な機能が追加された。まとめておこう。

## 3.0：タプル改善 + `unknown`型

```typescript
// タプルはrest引数をサポートするようになった
type Strings = [string, ...string[]];
type Numbers = [number, number, ...number[]];

function tail<T extends any[]>(arr: [any, ...T]): T {
  const [, ...rest] = arr;
  return rest as T;
}

// unknown：anyより安全な最上位型
function process(value: unknown) {
  // 使用前に型チェックが必要
  if (typeof value === "string") {
    console.log(value.toUpperCase()); // ✅ 型絞り込み後は安全
  }
  value.toUpperCase(); // ❌ コンパイルエラー
}

// anyとの比較：anyは型チェックをスキップ、unknownは検証を要求
function processAny(value: any) {
  value.toUpperCase(); // ✅ エラーなし、ただし実行時にクラッシュする可能性
}
```

## 3.1：マップ型のアップグレード

```typescript
// マップ型はタプルと配列をサポートするようになった
type Stringify<T> = { [K in keyof T]: string };

type NumbersStr = Stringify<[number, number]>;
// [string, string] と等価

// 関数プロパティへのマッピング
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
```

## 3.2：strictBindCallApply

```typescript
// 有効にするとbind/call/applyにも型チェックが適用される
function add(a: number, b: number): number {
  return a + b;
}

const result = add.call(null, 1, "2"); // ❌ エラー：'2'はnumberではない
const bound = add.bind(null, 1); // bound: (b: number) => number
```

## 3.3：複合代入演算子の改善

```typescript
// ユニオン型の関数が呼び出せるようになった
type Adder = (a: number, b: number) => number;
type Concat = (a: string, b: string) => string;

let fn: Adder | Concat;
fn(1, 2); // ✅ 3.3以前はエラー、今はOK
fn("a", "b"); // ✅
```

## ユーティリティ型クイックリファレンス

```typescript
// 組み込みユーティリティ型
type Partial<T> = { [K in keyof T]?: T[K] }; // 全プロパティをオプショナルに
type Required<T> = { [K in keyof T]-?: T[K] }; // 全プロパティを必須に
type Readonly<T> = { readonly [K in keyof T]: T[K] }; // 読み取り専用
type Pick<T, K extends keyof T> = { [P in K]: T[P] }; // プロパティを選択
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>; // プロパティを除外
type Record<K extends string, T> = { [P in K]: T }; // オブジェクト型を構築
type Exclude<T, U> = T extends U ? never : T; // ユニオン型から除外
type Extract<T, U> = T extends U ? T : never; // ユニオン型から抽出
type NonNullable<T> = T extends null | undefined ? never : T;

// ReturnType：関数の戻り値型を取得
function getUser() {
  return { id: 1, name: "Alice" };
}
type User = ReturnType<typeof getUser>; // { id: number; name: string }
```

## Vueプロジェクトでの実践推奨

```typescript
// vue-property-decoratorとTSの組み合わせ
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class UserCard extends Vue {
  @Prop({ required: true })
  userId!: number;

  @Prop({ default: "default-avatar.png" })
  avatar!: string;

  // TSによりVuexアクションも型安全になる
  async loadUser() {
    const user: User = await this.$store.dispatch("user/fetch", this.userId);
  }
}
```

## まとめ
