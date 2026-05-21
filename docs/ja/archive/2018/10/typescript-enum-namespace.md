---
title: "TypeScript の列挙型と名前空間"
date: 2018-10-21 10:31:26
tags:
  - TypeScript
readingTime: 2
description: "TypeScript の列挙型（enum）は Java や C# から来た開発者がよく使う機能ですが、TS では注意すべき点があります。名前空間（namespace）は使用頻度が低いですが、適切なユースケースもあります。"
wordCount: 431
---

TypeScript の列挙型（enum）は Java や C# から来た開発者がよく使う機能ですが、TS では注意すべき点があります。名前空間（namespace）は使用頻度が低いですが、適切なユースケースもあります。

## 数値列挙型

```typescript
enum Direction {
  Up, // 0
  Down, // 1
  Left, // 2
  Right, // 3
}

console.log(Direction.Up); // 0
console.log(Direction[0]); // 'Up'（逆マッピング）
```

数値列挙型は双方向マッピング（値→名前、名前→値）を作成するため、コンパイル後のコード量が多くなります。

## 文字列列挙型（推奨）

```typescript
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// メリット：デバッグ時に読みやすく、0/1/2 のような意味不明な数字にならない
console.log(Status.Active); // 'ACTIVE'

// 使用例
function updateUser(status: Status) {
  api.patch("/user", { status });
}
updateUser(Status.Active);
```

## const enum：コンパイル時インライン化

```typescript
// 通常の enum はコンパイル後にオブジェクトを生成する
// const enum はコンパイル時にインライン化される（より小さなバンドル）
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir = Direction.Up;
// コンパイル後：const dir = 'UP'（直接置換、オブジェクトなし）
```

注意：`const enum` は逆マッピングをサポートせず、`Object.values(Direction)` も使用できません。

## 列挙型の代替案（より現代的）

多くのシナリオでは列挙型の代わりに共用型（Union Type）を使用できます：

```typescript
// 列挙型の書き方
enum Status {
  Active = "ACTIVE",
  Disabled = "DISABLED",
}

// 共用型の書き方（より簡潔）
type Status = "ACTIVE" | "DISABLED";

// または as const オブジェクトを使用（Object.values が使える）
const STATUS = {
  Active: "ACTIVE",
  Disabled: "DISABLED",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS]; // 'ACTIVE' | 'DISABLED'

// すべての値を取得
Object.values(STATUS); // ['ACTIVE', 'DISABLED']
```

## 名前空間

名前空間は ES6 モジュールが普及する前にコードを整理するために使われていましたが、現在は主にサードパーティの JS ライブラリの型宣言ファイルを書くために使われます：

```typescript
// window 上のグローバル変数を宣言
declare namespace window {
  const __CONFIG__: {
    apiUrl: string;
    version: string;
  };
}

// 使用例
console.log(window.__CONFIG__.apiUrl);
```

```typescript
// jQuery などのグローバルライブラリの型宣言を書く
declare namespace $ {
  function ajax(url: string, options?: object): Promise<any>;
  namespace fn {
    function extend(plugin: object): void;
  }
}
```

## 実際のプロジェクトでの推奨事項

```typescript
// API ステータスなど：文字列リテラル共用型を使用
type ApiStatus = "idle" | "loading" | "success" | "error";

// すべての値を反復する必要がある場合：as const オブジェクトを使用
const ROLES = {
  Admin: "admin",
  Editor: "editor",
  Viewer: "viewer",
} as const;

// 逆マッピングが必要な場合：通常の列挙型を使用
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

## まとめ

- 数値列挙型：逆マッピングがあるが、数字は読みにくい
- 文字列列挙型：読みやすく、推奨
- `const enum`：コンパイル時インライン化で小さなバンドル、ただし機能に制限あり
- 名前空間：現在は主にグローバルライブラリの型宣言に使用。新しいコードでは ES モジュールを使用する
