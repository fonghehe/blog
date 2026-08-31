---
title: "TypeScript条件型の深掘り"
date: 2019-09-23 11:02:29
tags:
  - TypeScript
readingTime: 4
description: "TypeScriptの条件型（Conditional Types）は、型システムの中で最も強力な特性の一つだ。型の条件分岐に応じて動的に新しい型を生成でき、JavaScriptの三項演算子に似ている。ジェネリクスと `infer` キーワードを組み合わせれば、極めて柔軟な型推論を実現できる。本記事では基本構文から応用まで、条件型を深く掘り下げる。"
wordCount: 543
---

TypeScript の条件型（Conditional Types）は、型システムの中で最も強力な特性の一つだ。型の条件分岐に応じて動的に新しい型を生成でき、JavaScript の三項演算子に似ている。ジェネリクスと `infer` キーワードを組み合わせれば、極めて柔軟な型推論を実現できる。本記事では基本構文から応用まで、条件型を深く掘り下げる。

## 条件型の基本構文

条件型は `extends` キーワードを使って型の判定を行う：

```ts
// 基本構文：T extends U ? X : Y
// TがUに代入可能なら結果はX、そうでなければY

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
type C = IsString<'hello'>; // true (字面量类型是 string 的子类型)
```

## 分散条件型

条件型の引数がユニオン型のとき、条件型は自動的に分配（distribute）される：

```ts
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// 結果：string[] | number[]（(string | number)[]ではない）

// 分配したくない場合は角括弧で囲む
type ToArrayNoDistribute<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNoDistribute<string | number>;
// 結果：(string | number)[]
```

### 実用例：特定の型を除外する

```ts
// Excludeの実装
type MyExclude<T, U> = T extends U ? never : T;

type Result = MyExclude<string | number | boolean, string>;
// 分配プロセス：
// string extends string ? never : string  => never
// number extends string ? never : number  => number
// boolean extends string ? never : boolean => boolean
// 結果：number | boolean

// Extractの実装
type MyExtract<T, U> = T extends U ? T : never;

type Result2 = MyExtract<string | number | boolean, string | number>;
// 結果：string | number
```

## inferキーワード

`infer` は条件型において型推論に用いるキーワードで、`extends` 句の中でのみ使用できる：

### 関数の戻り値の型を推論する

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;           // string
type B = ReturnType<(x: number) => boolean>; // boolean
type C = ReturnType<string>;                  // never

// 実際の使用例
function getUser() {
  return { id: 1, name: '張三', age: 25 };
}

type User = ReturnType<typeof getUser>;
// { id: number; name: string; age: number }
```

### 関数の引数の型を推論する

```ts
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

type A = Parameters<(a: string, b: number) => void>;
// [string, number]

type B = Parameters<() => void>;
// []

// 実際の使用例
function createUser(name: string, age: number, email: string) {
  return { name, age, email };
}

type CreateUserParams = Parameters<typeof createUser>;
// [string, number, string]
```

### Promise の中の型を推論する

```ts
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = UnwrapPromise<Promise<string>>; // string
type B = UnwrapPromise<Promise<number[]>>; // number[]
type C = UnwrapPromise<boolean>; // boolean

// 再帰的にアンラップ
type DeepUnwrapPromise<T> = T extends Promise<infer U>
  ? DeepUnwrapPromise<U>
  : T;

type D = DeepUnwrapPromise<Promise<Promise<string>>>; // string

// 実際の使用例
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json() as Promise<{ id: number; name: string }>;
}

type FetchResult = DeepUnwrapPromise<ReturnType<typeof fetchData>>;
// { id: number; name: string }
```

### 配列の要素の型を推論する

```ts
type ElementOf<T> = T extends (infer E)[] ? E : never;

type A = ElementOf<string[]>;      // string
type B = ElementOf<number[]>;      // number
type C = ElementOf<[string, number]>; // string | number
type D = ElementOf<string>;        // never

// タプルの最初の要素を推論
type First<T> = T extends [infer F, ...any[]] ? F : never;

type E = First<[string, number, boolean]>; // string
type F = First<[]>; // never

// タプルの最後の要素を推論
type Last<T> = T extends [...any[], infer L] ? L : never;

type G = Last<[string, number, boolean]>; // boolean
```

### オブジェクトのプロパティの型を推論する

```ts
type ValueType<T> = T extends { value: infer V } ? V : never;

type A = ValueType<{ value: string }>;  // string
type B = ValueType<{ value: number[] }>; // number[]
type C = ValueType<{ name: string }>;    // never
```

## 実践：APIレスポンス型の推論

```ts
// APIエンドポイントマッピングの定義
interface ApiEndpoints {
  '/users': {
    GET: { response: { id: number; name: string }[] };
    POST: {
      body: { name: string; email: string };
      response: { id: number };
    };
  };
  '/users/:id': {
    GET: { response: { id: number; name: string; email: string } };
    PUT: {
      body: { name?: string; email?: string };
      response: { success: boolean };
    };
    DELETE: { response: { success: boolean } };
  };
}

// パスとメソッドに基づいてリクエスト/レスポンス型を抽出
type ApiResponse<
  Endpoints extends Record<string, any>,
  Path extends keyof Endpoints,
  Method extends keyof Endpoints[Path]
> = Endpoints[Path][Method] extends { response: infer R } ? R : never;

type ApiBody<
  Endpoints extends Record<string, any>,
  Path extends keyof Endpoints,
  Method extends keyof Endpoints[Path]
> = Endpoints[Path][Method] extends { body: infer B } ? B : never;

// 使用例
type UsersResponse = ApiResponse<ApiEndpoints, '/users', 'GET'>;
// { id: number; name: string }[]

type CreateUserBody = ApiBody<ApiEndpoints, '/users', 'POST'>;
// { name: string; email: string }

type CreateUserResponse = ApiResponse<ApiEndpoints, '/users', 'POST'>;
// { id: number }

// 型安全なAPIクライアント
async function apiCall<
  Path extends keyof ApiEndpoints,
  Method extends keyof ApiEndpoints[Path] & string
>(
  path: Path,
  method: Method,
  ...args: ApiBody<ApiEndpoints, Path, Method> extends never
    ? []
    : [body: ApiBody<ApiEndpoints, Path, Method>]
): Promise<ApiResponse<ApiEndpoints, Path, Method>> {
  const [body] = args;
  const response = await fetch(`/api${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}

// 使用例 —— 完整的类型提示
const users = await apiCall('/users', 'GET');
// users: { id: number; name: string }[]

const newUser = await apiCall('/users', 'POST', {
  name: '張三',
  email: 'zhangsan@example.com',
});
// newUser: { id: number }
// 第3引数には完全な型ヒントがあり、必須フィールドが欠けているとエラーになる
```

## 実践：深い読み取り専用型

```ts
type DeepReadonly<T> = T extends (infer E)[]
  ? ReadonlyArray<DeepReadonly<E>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  features: string[];
}

type ReadonlyConfig = DeepReadonly<Config>;
// {
//   readonly database: {
//     readonly host: string;
//     readonly port: number;
//     readonly credentials: {
//       readonly username: string;
//       readonly password: string;
//     };
//   };
//   readonly features: ReadonlyArray<string>;
// }
```

## 実践：型安全なEventEmitter

```ts
type EventMap = {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  error: { code: number; message: string };
};

class TypedEmitter<T extends Record<string, any>> {
  private handlers: Partial<{
    [K in keyof T]: Array<(data: T[K]) => void>;
  }> = {};

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.handlers[event]?.forEach(handler => handler(data));
  }
}

// 使用例
const emitter = new TypedEmitter<EventMap>();

emitter.on('login', (data) => {
  console.log(data.userId);   // 型ヒント：string
  console.log(data.timestamp); // 型ヒント：number
});

emitter.emit('login', { userId: '123', timestamp: Date.now() }); // 正しい
// emitter.emit('login', { userId: 123 }); // 型エラー！
```

## まとめ

- 条件型は `T extends U ? X : Y` 構文を使い、型の関係に基づいて分岐判定を行う
- ユニオン型は条件型内で自動的に分配（distribute）される。`[T]` で囲むことで分配を阻止できる
- `infer` キーワードは条件型内でサブタイプを推論・抽出でき、型推論の核心的なツールである
- よく使われる組み込み条件型：`ReturnType`・`Parameters`・`Exclude`・`Extract`・`NonNullable`
- 条件型は再帰的に使用でき、`DeepReadonly`・`DeepUnwrapPromise` などの深い型操作を実現できる
- 実際のプロジェクトでは、API型推論・イベントシステムの型安全性・状態管理の型定義などでよく使われる
