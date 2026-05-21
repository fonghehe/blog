---
title: "TypeScript ジェネリクス入門"
date: 2018-08-23 15:14:48
tags:
  - TypeScript
readingTime: 2
description: "TypeScriptのジェネリクスはずっと難しいと感じられていますが、マスターすれば非常に実用的だと分かります。この記事では基礎からジェネリクスを説明します。"
wordCount: 374
---

TypeScriptのジェネリクスはずっと難しいと感じられていますが、マスターすれば非常に実用的だと分かります。この記事では基礎からジェネリクスを説明します。

## なぜジェネリクスが必要か

ジェネリクスを使わないと`any`を使うしかなく、型チェックが失われます：

```typescript
// ジェネリクスなし：型を固定するか、anyを使うしかない
function identity(value: any): any {
  return value;
}

const result = identity("hello");
// resultの型はany、コンパイラはstringと分からない
result.toUpperCase(); // エラーにならない（resultがstringでない可能性があっても）
```

ジェネリクスを使えば、型安全かつ柔軟に：

```typescript
// ジェネリクス：Tは型パラメータ、呼び出し時に指定
function identity<T>(value: T): T {
  return value;
}

const str = identity("hello"); // T = string
str.toUpperCase(); // ✅ コンパイラはstrがstringと分かる

const num = identity(42); // T = number
num.toFixed(2); // ✅ コンパイラはnumがnumberと分かる
```

## 基本構文

```typescript
// 関数ジェネリクス
function firstItem<T>(arr: T[]): T {
  return arr[0];
}

const first = firstItem([1, 2, 3]); // TはnumberとしてInferされる
const firstStr = firstItem(["a", "b"]); // TはstringとしてInferされる

// インターフェースジェネリクス
interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

interface User {
  id: number;
  name: string;
}

function fetchUser(): Promise<ApiResponse<User>> {
  return fetch("/api/user").then((r) => r.json());
}

const response = await fetchUser();
response.data.name; // ✅ 型はstring、コード補完あり
```

## 実践的な応用：APIリクエストのラップ

```typescript
// 汎用APIレスポンス型
interface Response<T> {
  code: number;
  message: string;
  data: T;
}

// ジェネリクスリクエスト関数
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json: Response<T> = await res.json();

  if (json.code !== 0) {
    throw new Error(json.message);
  }

  return json.data;
}

// 使用例：Tに具体的な型を指定して、完全な型ヒントを得る
interface User {
  id: number;
  name: string;
  email: string;
}

interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
}

const user = await request<User>("/api/users/1");
user.email; // ✅ 型はstring

const userList = await request<PaginatedList<User>>("/api/users");
userList.items[0].name; // ✅ 型はstring
```

## ジェネリクス制約（extends）

ジェネリクスが特定のプロパティを持つことを制約：

```typescript
// TはlengthプロパティをもつことをT extends { length: number }で制約
function printLength<T extends { length: number }>(value: T): number {
  return value.length;
}

printLength("hello"); // ✅ stringはlengthを持つ
printLength([1, 2, 3]); // ✅ 配列はlengthを持つ
printLength(42); // ❌ numberはlengthを持たない
```

```typescript
// KはTのキーでなければならない
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25, email: "alice@example.com" };

getProperty(user, "name"); // ✅ 戻り値の型はstring
getProperty(user, "age"); // ✅ 戻り値の型はnumber
getProperty(user, "phone"); // ❌ 'phone'はuserのキーではない
```

## ジェネリクスユーティリティ型

TypeScriptには便利なジェネリクスユーティリティが組み込まれています：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial：すべてのプロパティをオプションに
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; password?: string }

// Required：すべてのプロパティを必須に
type RequiredUser = Required<PartialUser>;

// Pick：指定したプロパティのみ保持
type UserProfile = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

// Omit：指定したプロパティを除外
type SafeUser = Omit<User, "password">;
// { id: number; name: string; email: string }

// Readonly：すべてのプロパティを読み取り専用に
type ReadonlyUser = Readonly<User>;

// Record：キーと値のペア型
type UserMap = Record<string, User>;
// { [key: string]: User }
```

実際の使用：

```typescript
// ユーザー更新時は変更されたフィールドだけ渡す
function updateUser(
  id: number,
  updates: Partial<Omit<User, "id">>,
): Promise<User> {
  return request(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

updateUser(1, { name: "Bob" }); // ✅ nameだけ更新
updateUser(1, { id: 2 }); // ❌ idは更新できない（Omitで除外されている）
```

## VueコンポーネントでのジェネリクスIの使用

```typescript
// 汎用リストコンポーネント
import Vue from "vue";

// Props型
interface TableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => string;
}

export default Vue.extend({
  props: {
    data: {
      type: Array as () => any[],
      required: true,
    },
    columns: {
      type: Array as () => TableColumn<any>[],
      required: true,
    },
  },
});
```

## まとめ

- ジェネリクスにより、関数/クラス/インターフェースが複数の型に対応しつつ型安全を保てる
- `<T extends SomeType>`でジェネリクスが特定の条件を満たすよう制約できる
- `keyof T`で型のすべてのキーを取得、`T[K]`で特定のプロパティの型を取得
- `Partial`、`Pick`、`Omit`などのユーティリティ型は実際の開発で非常に役立つ
