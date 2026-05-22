---
title: "TypeScript 泛型入門：落地路徑與實戰建議"
date: 2018-08-23 15:14:48
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 的泛型一直讓人覺得難，但掌握了之後會發現它非常實用。這篇文章從基礎開始講泛型。"
wordCount: 213
---

TypeScript 的泛型一直讓人覺得難，但掌握了之後會發現它非常實用。這篇文章從基礎開始講泛型。

## 為什麼需要泛型

不用泛型，隻能用 `any`，失去類型檢查：

```typescript
// 不用泛型：要麼寫死類型，要麼用 any
function identity(value: any): any {
  return value;
}

const result = identity("hello");
// result 的類型是 any，編譯器不知道它是 string
result.toUpperCase(); // 不會報錯，即使 result 可能不是 string
```

用泛型，類型安全且靈活：

```typescript
// 泛型：T 是類型參數，調用時指定
function identity<T>(value: T): T {
  return value;
}

const str = identity("hello"); // T = string
str.toUpperCase(); // ✅ 編譯器知道 str 是 string

const num = identity(42); // T = number
num.toFixed(2); // ✅ 編譯器知道 num 是 number
```

## 基礎語法

```typescript
// 函數泛型
function firstItem<T>(arr: T[]): T {
  return arr[0];
}

const first = firstItem([1, 2, 3]); // T 推斷為 number
const firstStr = firstItem(["a", "b"]); // T 推斷為 string

// 接口泛型
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
response.data.name; // ✅ 類型是 string，有代碼提示
```

## 實際應用：封裝 API 請求

```typescript
// 通用的 API 響應類型
interface Response<T> {
  code: number;
  message: string;
  data: T;
}

// 泛型請求函數
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json: Response<T> = await res.json();

  if (json.code !== 0) {
    throw new Error(json.message);
  }

  return json.data;
}

// 使用：T 指定為具體類型，有完整的類型提示
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
user.email; // ✅ 類型是 string

const userList = await request<PaginatedList<User>>("/api/users");
userList.items[0].name; // ✅ 類型是 string
```

## 泛型約束（extends）

限製泛型必須包含某些屬性：

```typescript
// T 必須有 length 屬性
function printLength<T extends { length: number }>(value: T): number {
  return value.length;
}

printLength("hello"); // ✅ string 有 length
printLength([1, 2, 3]); // ✅ array 有 length
printLength(42); // ❌ number 沒有 length
```

```typescript
// K 必須是 T 的鍵
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25, email: "alice@example.com" };

getProperty(user, "name"); // ✅ 返回類型 string
getProperty(user, "age"); // ✅ 返回類型 number
getProperty(user, "phone"); // ❌ 'phone' 不是 user 的鍵
```

## 泛型工具類型

TypeScript 內置了一些常用的泛型工具：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial：所有屬性變為可選
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; password?: string }

// Required：所有屬性變為必須
type RequiredUser = Required<PartialUser>;

// Pick：隻保留指定屬性
type UserProfile = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

// Omit：排除指定屬性
type SafeUser = Omit<User, "password">;
// { id: number; name: string; email: string }

// Readonly：所有屬性變為隻讀
type ReadonlyUser = Readonly<User>;

// Record：鍵值對類型
type UserMap = Record<string, User>;
// { [key: string]: User }
```

實際使用：

```typescript
// 更新用户時隻傳變化的字段
function updateUser(
  id: number,
  updates: Partial<Omit<User, "id">>,
): Promise<User> {
  return request(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

updateUser(1, { name: "Bob" }); // ✅ 隻更新 name
updateUser(1, { id: 2 }); // ❌ id 不能更新（被 Omit 排除了）
```

## 在 Vue 組件中使用泛型

```typescript
// 通用列表組件
import Vue from "vue";

// Props 類型
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

## 小結

- 泛型讓函數/類/接口適用於多種類型，同時保持類型安全
- `<T extends SomeType>` 約束泛型必須滿足某些條件
- `keyof T` 獲取類型的所有鍵，`T[K]` 獲取具體屬性類型
- `Partial`、`Pick`、`Omit` 等工具類型在實際開發中非常常用
