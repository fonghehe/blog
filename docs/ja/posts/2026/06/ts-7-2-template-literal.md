---
title: "TypeScript 7.2 テンプレートリテラル型の高度な使い方"
date: 2026-06-03 14:06:50
tags:
  - TypeScript
readingTime: 4
description: "TypeScript 7.2 でテンプレートリテラル型が大幅に強化された。型推論、文字列操作、実践的なユースケースを深く解説し、大規模プロジェクトでの型システム活用を支援する。"
wordCount: 862
---

TypeScript のテンプレートリテラル型は 4.1 で導入されて以来、型体操のコア機能となっている。7.2 バージョンでは、より強力な推論能力和組み込みの文字列操作ツールが追加され、複雑な文字列型の推論がより直感的になった。

## 基本復習と 7.2 の強化

テンプレートリテラル型のコアは `${T}` 構文で、テンプレート内に文字列リテラル型を埋め込むことができる：

```typescript
type EventName = 'click' | 'focus' | 'blur'
type HandlerName = `on${Capitalize<EventName>}`
// 'onClick' | 'onFocus' | 'onBlur'
```

7.2 では `Uncapitalize<T>` ユーティリティ型が追加され、`Capitalize` と対称になった：

```typescript
type MethodName = 'getUserData' | 'setUserData'
type RawName = Uncapitalize<MethodName>
// 'getUserData' | 'setUserData' — 既に小文字始まり

type ClassName = 'ButtonPrimary' | 'CardSecondary'
type cssClass = Uncapitalize<ClassName>
// 'buttonPrimary' | 'cardSecondary'
```

## 高度な型推論パターン

7.2 の最も重要な改善は、テンプレートリテラル型の推論能力の強化だ。より複雑なパターンで部分文字列を抽出できるようになった：

```typescript
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never

type Params = ExtractRouteParams<'/users/:id/posts/:postId'>
// 'id' | 'postId'
```

`infer` キーワードと組み合わせることで、より精細な文字列パースが実現できる：

```typescript
type ParseQueryString<T extends string> =
  T extends `${infer Key}=${infer Value}&${infer Rest}`
    ? { [K in Key]: Value } & ParseQueryString<Rest>
    : T extends `${infer Key}=${infer Value}`
      ? { [K in Key]: Value }
      : {}

type Query = ParseQueryString<'page=1&limit=20&sort=date'>
// { page: '1' } & { limit: '20' } & { sort: 'date' }
```

## 実践的なユースケース

### API パスの型安全

大規模プロジェクトでは、型安全な API パスがランタイムエラーを大幅に削減できる：

```typescript
type ApiVersion = 'v1' | 'v2' | 'v3'
type Resource = 'users' | 'posts' | 'comments'
type Action = 'list' | 'create' | 'update' | 'delete'

type ApiPath = `/${ApiVersion}/${Resource}/${Action}`
// '/v1/users/list' | '/v1/users/create' | ... (全36パターン)

function apiCall<T extends ApiPath>(path: T): Promise<Response> {
  return fetch(`/api${path}`)
}
```

### CSS 変数の型推論

CSS カスタムプロパティと組み合わせることで、テーマ変数の型安全が実現できる：

```typescript
type ThemeToken = 'primary' | 'secondary' | 'accent' | 'background' | 'text'
type TokenShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
type CssVariable = `--color-${ThemeToken}-${TokenShade}`
```

## 再帰テンプレートリテラル型

7.2 では再帰テンプレートリテラル型のパフォーマンスが最適化され、深いネストでも効率的な型推論が可能になった：

```typescript
type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}`
    ? [Head, ...Split<Tail, D>]
    : [S]

type Result = Split<'a.b.c.d', '.'>
// ['a', 'b', 'c', 'd']
```

## 条件型との統合

テンプレートリテラル型を条件型と組み合わせることで、複雑な型変換を実装できる：

```typescript
type Camelize<T extends string> =
  T extends `${infer Head}_${infer Tail}`
    ? `${Head}${Camelize<Capitalize<Tail>>}`
    : T

type Result1 = Camelize<'user_name'>  // 'userName'
type Result2 = Camelize<'get_user_data'>  // 'getUserData'

// オブジェクトキー名の一括変換
type CamelizeKeys<T extends Record<string, any>> = {
  [K in keyof T as Camelize<K & string>]: T[K]
}

interface RawUser {
  user_name: string
  created_at: string
  is_active: boolean
}

type User = CamelizeKeys<RawUser>
// { userName: string; createdAt: string; isActive: boolean }
```

## パフォーマンスの注意点

7.2 では再帰型のパフォーマンスが最適化されたが、実際のプロジェクトでは以下に注意する必要がある：

1. **深い再帰を避ける**：10 レベルを超える再帰テンプレートリテラル型はコンパイル時間が大幅に増加する可能性がある
2. **`never` のショートサーキットを活用**：再帰型で早期に `never` を返すことで、無効な計算を回避できる
3. **複雑な型をキャッシュ**：頻繁に使用する複雑な型は独立した型エイリアスとして抽出する

## まとめ

TypeScript 7.2 のテンプレートリテラル型の強化により、文字列操作の型推論がより強力で直感的になった。API パスの型安全から CSS 変数の推論、ルートパラメータのパースからオブジェクトキー名の変換まで、这些機能は大規模プロジェクトで開発体験とコードの信頼性を大幅に向上できる。これらのパターンをマスターする鍵は、再帰推論の考え方を理解すること——文字列を分解して再構築できるデータ構造として扱うことだ。
