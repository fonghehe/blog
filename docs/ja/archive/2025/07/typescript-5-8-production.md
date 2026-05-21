---
title: "TypeScript 5.8 本番実践：型安全の境界とコスト"
date: 2025-07-23 10:00:00
tags:
  - TypeScript
  - セキュリティ
readingTime: 3
description: "TypeScript 5.8 は 2025 年 2 月にリリースされました（ここでは実際のプロジェクトで採用したバージョンを指します）。数ヶ月の本番運用を経て、TypeScript の厳格な型システムの実践経験を共有します——どの新機能が本当に役立つか、また大規模プロジェクトで予期しない問題を引き起こすものは何かについ"
wordCount: 558
---

TypeScript 5.8 は 2025 年 2 月にリリースされました（ここでは実際のプロジェクトで採用したバージョンを指します）。数ヶ月の本番運用を経て、TypeScript の厳格な型システムの実践経験を共有します——どの新機能が本当に役立つか、また大規模プロジェクトで予期しない問題を引き起こすものは何かについてです。

## TypeScript 5.8 主要機能の概要

### 1. --erasableSyntaxOnly：Node.js ネイティブ TS サポートに向けた最適化

Node.js 22 以降は `.ts` ファイルを直接実行できますが（.js を生成しない）、「消去可能な構文」のみサポートされています（`enum` や `namespace` などのランタイム構文は不可）。TS 5.8 は違反を検出する `--erasableSyntaxOnly` オプションを追加しました：

```json
// tsconfig.json（Node.js ネイティブ TS プロジェクト用）
{
  "compilerOptions": {
    "erasableSyntaxOnly": true // enum、namespace などのランタイム構文を禁止
  }
}
```

```typescript
// ❌ エラー：enum は消去可能な構文ではない
enum Status {
  Active,
  Inactive,
}

// ✅ 代替案：const オブジェクト + 型
const Status = {
  Active: "active",
  Inactive: "inactive",
} as const;
type Status = (typeof Status)[keyof typeof Status];

// ✅ 代替案：string literal union
type Status = "active" | "inactive";
```

### 2. 条件型における infer の改善

```typescript
// TS 5.8 以前：Promise の返り値の内部型を取り出すには infer のネストが必要だった
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type UnwrapAll<T> =
  T extends Promise<infer U>
    ? UnwrapAll<U> // 手動で再帰が必要
    : T;

// TS 5.8：infer extends 構文がより強力に
type ExtractArrayItem<T> = T extends (infer Item)[]
  ? Item extends string
    ? `string:${Item}`
    : Item
  : never;

// より実用的：API 返り値の正確な型を抽出
type ApiResponse<T extends (...args: any) => any> =
  Awaited<ReturnType<T>> extends { data: infer D } ? D : never;

// 使用例
async function fetchUser(id: string): Promise<{ data: User; meta: Meta }> {
  return await api.get(id);
}
type UserData = ApiResponse<typeof fetchUser>; // User
```

## 本番で遭遇した TypeScript 厳格型の問題

### 問題 1：noUncheckedIndexedAccess と配列操作

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true  // 有効にすると：配列アクセスが T | undefined を返す
  }
}

// ❌ 有効化後、以前は問題なかったコードがエラーになる
function getFirst<T>(arr: T[]): T {
  return arr[0];  // エラー：Type 'T | undefined' is not assignable to type 'T'
}

// ✅ 修正方法 1：非 null アサーション
function getFirst<T>(arr: T[]): T {
  return arr[0]!;  // （配列が空でないことを確認する必要がある）
}

// ✅ 修正方法 2：より安全なシグネチャ
function getFirst<T>(arr: [T, ...T[]]): T {  // 少なくとも 1 要素を持つタプル
  return arr[0];
}

// ✅ 修正方法 3：undefined を明示的に処理
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

実践アドバイス：大規模プロジェクトで `noUncheckedIndexedAccess` を有効にすると大量のエラーが発生します。全体に適用するのではなく、新しいモジュールで段階的に試すことをお勧めします。

### 問題 2：satisfies 演算子のパフォーマンスオーバーヘッド

```typescript
// 複雑なオブジェクトに satisfies を使うと、型チェックのパフォーマンスコストが顕著になる
// 特に大きな設定オブジェクトで問題になる

// ❌ 大きなオブジェクトへの大量の satisfies 使用で tsc が遅くなる
const config = {
  routes: [...],  // 1000+ のルート設定
  plugins: [...], // 100+ のプラグイン
} satisfies AppConfig;

// ✅ パフォーマンスが重要なシナリオでは型アノテーションを使う
const config: AppConfig = {
  routes: [...],
  plugins: [...],
};
```

### 問題 3：テンプレートリテラル型の再帰制限

```typescript
// 深くネストされたテンプレートリテラル型は TypeScript の再帰制限を引き起こす
type DeepPath<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? `${Prefix}${K & string}` | DeepPath<T[K], `${Prefix}${K & string}.`>
        : `${Prefix}${K & string}`;
    }[keyof T]
  : never;

// 4〜5 層を超えるオブジェクトでは "Type instantiation is excessively deep" エラーが出る
// 実践：深さを制限するか、複雑な型推論の代わりにランタイム検証（zod、yup）を使う
```

## TS 5.8 で価値のある新機能

```typescript
// 1. より賢い制御フローの絞り込み（自動的な narrowing がこれまで以上に正確）
function processValue(val: string | number | null) {
  if (val === null) return;
  // 5.8：複雑なブランチでも val の型推論がより正確になった
  const result = typeof val === "string" ? val.toUpperCase() : val.toFixed(2);
  // result: string（5.8 はユニオン型の各ブランチの結果型を正しく推論）
}

// 2. デコレーターメタデータの改善（Angular/NestJS と組み合わせて使用）
// TS 5.8 は Stage 3 デコレーターのメタデータアクセスをより良くサポート
```

## まとめ

TypeScript 5.8 は 5.x シリーズの「エッジケースを継続的に磨く」というリズムを維持しており、破壊的な変更はありません。本番プロジェクトで最も価値があるのは `--erasableSyntaxOnly`（Node.js ネイティブ TS の準備）と改善された制御フローの絞り込みです。`noUncheckedIndexedAccess` は理論的にはより安全ですが、大規模プロジェクトへの導入コストが高いため、新しいモジュールで段階的に試すことをお勧めします。
