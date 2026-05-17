---
title: "TypeScriptのユーティリティ型を深く掘り下げる"
date: 2019-06-08 09:40:54
tags:
  - TypeScript
readingTime: 1
description: "TypeScriptにはユーティリティ型のコレクションが付属しています。多くの開発者は`Partial`や`Pick`を知っていますが、全体のライブラリははるかに豊富で強力です。"
---

TypeScriptにはユーティリティ型のコレクションが付属しています。多くの開発者は`Partial`や`Pick`を知っていますが、全体のライブラリははるかに豊富で強力です。

## 組み込みユーティリティ型

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  role: "admin" | "user" | "guest";
}

// Partial<T> — すべてのプロパティがオプショナルに
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; ... }

// Required<T> — すべてのプロパティが必須に（Partialの逆）
type RequiredUser = Required<PartialUser>;

// Pick<T, K> — プロパティのサブセットを選択
type UserProfile = Pick<User, "name" | "email">;
// { name: string; email: string }

// Omit<T, K> — プロパティを除外
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; age: number; role: ... }

// Record<K, V> — マップ型：キー → 値
type RoleMap = Record<User["role"], string[]>;
// { admin: string[]; user: string[]; guest: string[] }

// Readonly<T> — すべてのプロパティがreadonlyに
type ReadonlyUser = Readonly<User>;
// 代入後はプロパティを変更できない

// NonNullable<T> — nullとundefinedを除去
type MaybeUser = User | null | undefined;
type DefiniteUser = NonNullable<MaybeUser>; // User

// ReturnType<T> — 関数の戻り値の型を抽出
function fetchUser(): Promise<User> {
  /* ... */
}
type FetchResult = ReturnType<typeof fetchUser>; // Promise<User>

// Parameters<T> — 関数のパラメーター型をタプルとして抽出
type FetchParams = Parameters<typeof fetchUser>; // []
```

## 条件型とinfer

```typescript
// infer: 条件型マッチング中にジェネリック内から型を抽出
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
// UnpackPromise<Promise<string>> → string
// UnpackPromise<number>         → number

// 配列から要素型を抽出
type UnpackArray<T> = T extends Array<infer Item> ? Item : T;
// UnpackArray<string[]> → string

// 非同期関数の戻り値型を抽出
type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : never;

async function getUser(): Promise<User> {
  /* ... */
}
type UserType = AsyncReturnType<typeof getUser>; // User
```

## カスタムDeepPartial

組み込みの`Partial`は1レベルのみです。ネストされたオブジェクトには再帰的なバージョンを使用：

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      enabled: boolean;
      cert: string;
    };
  };
  database: {
    url: string;
    poolSize: number;
  };
}

// 深いPartial — ネストされたプロパティもすべてオプショナル
type PartialConfig = DeepPartial<Config>;
const config: PartialConfig = {
  server: {
    host: "localhost",
    // port、sslは省略可
  },
  // databaseは完全に省略可
};
```

TypeScriptのユーティリティ型システムは最も強力な機能の一つです。独自のものを書く前に組み込みユーティリティを学ぶ時間を投資しましょう——実際のシナリオの大部分をカバーしています。
