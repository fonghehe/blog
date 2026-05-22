---
title: "TypeScript 4.1 新機能解説"
date: 2020-11-24 17:33:01
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.1 がリリースされ、いくつかの非常に実用的な型システムの拡張がもたらされました。特にテンプレートリテラル型と再帰的条件型により、型プログラミングの能力がさらに向上しました。"
wordCount: 333
---

TypeScript 4.1 がリリースされ、いくつかの非常に実用的な型システムの拡張がもたらされました。特にテンプレートリテラル型と再帰的条件型により、型プログラミングの能力がさらに向上しました。

## テンプレートリテラル型

```typescript
// テンプレート文字列に似ていますが、型レベルで動作します
type Color = 'red' | 'blue';
type Size = 'sm' | 'lg';

// 組み合わせ型を生成
type ColorSize = `${Color}-${Size}`;
// 'red-sm' | 'red-lg' | 'blue-sm' | 'blue-lg'

// 実践的なユースケース：イベント名の推論
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

// CSSクラス名の生成に活用
type Breakpoint = 'sm' | 'md' | 'lg';
type CSSProperty = 'padding' | 'margin';
type ResponsiveClass = `${Breakpoint}:${CSSProperty}`;
// 'sm:padding' | 'sm:margin' | 'md:padding' | ...
```

## マップ型でのキーリマッピング

```typescript
// 以前：マップ型は元のキーしか保持できませんでした
type Getters<T> = {
  [K in keyof T]: () => T[K];
};

// TypeScript 4.1：as を使ってキーを再マッピング可能
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
  name: string;
  age: number;
}

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// 実践的なユースケース：キーのフィルタリング
type ExtractStringKeys<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

interface Config {
  name: string;
  count: number;
  active: boolean;
  label: string;
}

type StringConfig = ExtractStringKeys<Config>;
// { name: string; label: string }
```

## 再帰的条件型

```typescript
// TypeScript 4.1 は条件型の再帰制限を緩和しました

// 深い Readonly
type DeepReadonly<T> = T extends (infer U)[]
  ? Readonly<DeepReadonly<U>[]>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

interface State {
  user: {
    name: string;
    profile: {
      avatar: string;
      bio: string;
    };
  };
  settings: {
    theme: string;
  };
}

type ReadonlyState = DeepReadonly<State>;
// user.profile.avatar も readonly、すべてのネストされたプロパティが readonly

// ネストされた配列を平坦化
type Flatten<T> = T extends (infer U)[]
  ? U extends (infer V)[]
    ? Flatten<V>
    : U
  : T;

type Result = Flatten<string[][][]>;
// string
```

## 再帰型参照の深度向上

```typescript
// TypeScript 4.0 以前は再帰の深さ制限が厳しかった
// 4.1 で制限が緩和されました

// JSON 型の定義
type Json = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [Key in string]?: Json };
type JsonArray = Json[];

// パス型の抽出
type PathKeys<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${PathKeys<T[K]>}` | K
    : K
  : never;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  server: {
    port: number;
  };
}

type ConfigPaths = PathKeys<Config>;
// "database" | "server" | "database.host" | "database.port"
// | "database.credentials" | "database.credentials.username"
// | "database.credentials.password" | "server.port"
```

## 文字列・数値インデックスアクセス

```typescript
// 数値インデックスでタプル型にアクセス
type Tuple = [string, number, boolean];

type First = Tuple[0]; // string
type Second = Tuple[1]; // number
type Length = Tuple['length']; // 3

// テンプレートリテラルでタプル型を抽出
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

type H = Head<[1, 2, 3]>; // 1
type T = Tail<[1, 2, 3]>; // [2, 3]
```

## より良いエラーメッセージ

```typescript
// TypeScript 4.1 のエラーメッセージがより明確に

// 深い型の不一致時、どのプロパティに問題があるか具体的に示す
interface User {
  name: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
}

const user: User = {
  name: '张三',
  age: 28,
  address: {
    city: '北京',
    zip: 123,  // Error: Type 'number' is not assignable to type 'string'
               // 以前は不明瞭でしたが、今は address.zip の問題だと明確に示されます
  },
};
```

## tsconfig の設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```bash
# アップグレード
npm install typescript@4.1 -D

# バージョンの確認
npx tsc --version
```

## まとめ

- テンプレートリテラル型により、型プログラミングで文字列操作が可能になり、非常に強力です
- Key Remapping によりマップ型のキーをリネームでき、派生型がより柔軟になりました
- 再帰的条件型の制限が緩和され、深くネストされた型変換が実現可能になりました
- エラーメッセージがより正確になり、型の問題のデバッグが効率的になりました
- TypeScript はますます型プログラミング言語らしくなっています
