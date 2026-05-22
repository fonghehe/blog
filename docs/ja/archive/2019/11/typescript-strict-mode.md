---
title: "TypeScript strictモードのベストプラクティス"
date: 2019-11-20 09:57:07
tags:
  - TypeScript
readingTime: 4
description: "TypeScript の strict モードは一連の厳格な型チェックオプションを有効にし、コンパイル時に多くの潜在的なエラーを捕捉できます。既存のプロジェクトにとって、strict モードを有効にすると大量のエラーが発生する可能性があります。この記事では strict モードの各オプションを詳しく紹介し、プロジェクトに段階的に厳格な型チェックを導入する方法を説明します。"
wordCount: 778
---

TypeScriptの`strict`モードは、一連の厳格な型チェックオプションを有効にし、コンパイル時に多くの潜在的なエラーを捕捉できます。既存のプロジェクトにとって、strictモードを有効にすると大量のエラーが発生する可能性があります。この記事ではstrictモードの各オプションを詳しく紹介し、プロジェクトに段階的に厳格な型チェックを導入する方法を説明します。

## strictモードに含まれるもの

`strict: true`は実際には以下のすべてのオプションを有効にすることと同等です：

```json
{
  "compilerOptions": {
    "strict": true,
    // 以下を同時に有効にするのと同じ：
    // "noImplicitAny": true,
    // "strictNullChecks": true,
    // "strictFunctionTypes": true,
    // "strictBindCallApply": true,
    // "strictPropertyInitialization": true,
    // "noImplicitThis": true,
    // "alwaysStrict": true
  }
}
```

## noImplicitAny

暗黙的な`any`型を禁止します。すべての変数、パラメータに明確な型が必要です：

```ts
// 無効時（緩やかなモード）：パラメータが暗黙的にanyになる
function add(a, b) {
  return a + b;
}

// 有効後：明示的に型を指定する必要がある
function add(a: number, b: number): number {
  return a + b;
}

// または型推論を使用（パラメータは引き続き指定が必要）
const multiply = (a: number, b: number) => a * b;
```

よくあるエラーとその解決：

```ts
// エラー：Parameter 'event' implicitly has an 'any' type
// document.addEventListener('click', (event) => {
//   console.log(event.clientX);
// });

// 解決：正しいイベント型を指定する
document.addEventListener('click', (event: MouseEvent) => {
  console.log(event.clientX);
});

// エラー：Binding element 'name' implicitly has an 'any' type
// function greet({ name }) {
//   return `Hello, ${name}`;
// }

// 解決：分割代入のパラメータに型を指定する
function greet({ name }: { name: string }) {
  return `Hello, ${name}`;
}

// またはinterfaceを使用
interface User {
  name: string;
  age?: number;
}

function greet(user: User) {
  return `Hello, ${user.name}`;
}
```

## strictNullChecks

`null`と`undefined`はすべての型のサブタイプではなくなり、明示的に処理する必要があります：

```ts
// 無効時：nullを無視できる
const name: string = null; // エラーにならない

// 有効後：nullをstringに代入できない
const name: string | null = null; // 明示的に宣言する必要がある

// よくあるシナリオ
function getLength(str: string | undefined): number {
  // エラー：Object is possibly 'undefined'
  // return str.length;

  // 解決1：型ガード
  if (str === undefined) return 0;
  return str.length;

  // 解決2：オプショナルチェーン（TypeScript 3.7+）
  // return str?.length ?? 0;

  // 解決3：非nullアサーション（nullでないと確信できる場合）
  // return str!.length;
}
```

実際のプロジェクトでの応用：

```ts
interface User {
  id: number;
  name: string;
  email: string | null;     // メールアドレスがない可能性がある
  avatar?: string;          // オプションのプロパティ
}

function displayUser(user: User | null) {
  // nullをチェックする必要がある
  if (!user) {
    return '<p>未登录</p>';
  }

  // nullの可能性があるプロパティを処理する必要がある
  const emailDisplay = user.email ?? '未绑定邮箱';
  const avatarUrl = user.avatar ?? '/default-avatar.png';

  return `
    <img src="${avatarUrl}" alt="${user.name}" />
    <p>${user.name}</p>
    <p>${emailDisplay}</p>
  `;
}

// 配列メソッド使用時
function findUser(id: number): User | undefined {
  return users.find(u => u.id === id);
}

const user = findUser(1);
// userはundefinedの可能性がある
if (user) {
  console.log(user.name); // 安全
}

// Array.find は T | undefined を返す
const firstUser = users[0]; // エラー：範囲外の可能性
const firstUserSafe = users[0]; // チェックが必要
```

## strictFunctionTypes

関数のパラメータ型チェックがより厳格になり、反変性（contravariance）チェックを使用します：

```ts
// 無効時：パラメータ型は双方向の共変
type Handler = (event: Event) => void;
type MouseHandler = (event: MouseEvent) => void;

const mouseHandler: MouseHandler = (e) => console.log(e.clientX);
const handler: Handler = mouseHandler; // エラーにならない

// 有効後：パラメータ型は反変
// MouseHandlerのパラメータはHandlerより具体的
// HandlerにMouseHandlerを代入できない
// Handlerが呼び出される際にMouseEvent以外のEventが渡される可能性があるため
```

## strictPropertyInitialization

クラスのプロパティはコンストラクタで初期化するか、デフォルト値を持つ必要があります：

```ts
class User {
  // エラー：Property 'name' has no initializer
  // name: string;

  // 解決1：コンストラクタで初期化
  name: string;
  constructor(name: string) {
    this.name = name;
  }

  // 解決2：デフォルト値を使用
  role: string = 'user';

  // 解決3：!アサーションを使用（他の場所で初期化されることが確定している場合）
  avatar!: string;

  // 解決4：オプショナルプロパティ
  nickname?: string;
}
```

## 段階的なstrictの有効化

既存のプロジェクトでは、一度にすべてのstrictオプションを有効にすることはお勧めしません。段階的に移行することができます：

### ステップ1：noImplicitAnyを有効化

```json
{
  "compilerOptions": {
    "noImplicitAny": true
  }
}
```

対処方針：型が不明なパラメータについては、一時的に`any`または`unknown`を使用します：

```ts
// サードパーティライブラリのコールバック
function handleResponse(data: any) {
  // 徐々に型を追加
}

// unknownを使用するとより安全（型ガードが必要）
function handleResponseSafe(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // 安全にアクセスできる
  }
}
```

### ステップ2：strictNullChecksを有効化

これが最も難しいステップです。既存のコードではnull処理がほとんど行われていないためです：

```json
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

`// @ts-ignore`や`as any`で一時的に回避し、徐々に修正します：

```ts
// 一時的な回避
// @ts-ignore
const name: string = userData.name;

// 徐々に修正
const name: string = userData?.name ?? 'unknown';
```

### ステップ3：残りのオプションを有効化

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## anyの代わりにunknownを使う

`unknown`は型安全な`any`です：

```ts
// any：型チェックを無効化
function processAny(data: any) {
  data.foo.bar; // エラーにならないが、実行時にエラーになる可能性がある
}

// unknown：型チェックを強制
function processUnknown(data: unknown) {
  // data.foo.bar; // エラー：'data' is of type 'unknown'

  // 先に型をチェックする必要がある
  if (typeof data === 'object' && data !== null && 'foo' in data) {
    const obj = data as { foo: { bar: string } };
    obj.foo.bar; // 安全
  }
}

// 実際のシナリオ：APIレスポンス処理
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();

  // 型ガードによる検証
  if (!isValidUser(data)) {
    throw new Error('Invalid user data');
  }

  return data;
}

function isValidUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  );
}
```

## よく使う型ガード

```ts
// typeof型ガード
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// instanceof型ガード
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// カスタム型ガード
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'data' in value
  );
}
```

## まとめ

- `strict: true`には7つの厳格な型チェックオプションが含まれています
- `noImplicitAny`は暗黙的なanyを禁止し、`strictNullChecks`はnull/undefinedの処理を強制します
- 段階的に有効化することをお勧めします：最初にnoImplicitAny、次にstrictNullChecks、最後にすべてを有効化
- `any`の代わりに`unknown`を使用して、型安全性を高めましょう
- 型ガード（type guard）はユニオン型を扱うための重要なツールです
- `// @ts-ignore`を一時的に使用してエラーを回避し、徐々に修正していきましょう
- strictモードは初期の投資は大きいですが、実行時エラーを大幅に削減できます
