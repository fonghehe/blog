---
title: "TypeScript 泛型入门"
date: 2018-08-23 15:14:48
tags:
  - TypeScript
---

TypeScript 的泛型一直让人觉得难，但掌握了之后会发现它非常实用。这篇文章从基础开始讲泛型。

## 为什么需要泛型

不用泛型，只能用 `any`，失去类型检查：

```typescript
// 不用泛型：要么写死类型，要么用 any
function identity(value: any): any {
  return value;
}

const result = identity("hello");
// result 的类型是 any，编译器不知道它是 string
result.toUpperCase(); // 不会报错，即使 result 可能不是 string
```

用泛型，类型安全且灵活：

```typescript
// 泛型：T 是类型参数，调用时指定
function identity<T>(value: T): T {
  return value;
}

const str = identity("hello"); // T = string
str.toUpperCase(); // ✅ 编译器知道 str 是 string

const num = identity(42); // T = number
num.toFixed(2); // ✅ 编译器知道 num 是 number
```

## 基础语法

```typescript
// 函数泛型
function firstItem<T>(arr: T[]): T {
  return arr[0];
}

const first = firstItem([1, 2, 3]); // T 推断为 number
const firstStr = firstItem(["a", "b"]); // T 推断为 string

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
response.data.name; // ✅ 类型是 string，有代码提示
```

## 实际应用：封装 API 请求

```typescript
// 通用的 API 响应类型
interface Response<T> {
  code: number;
  message: string;
  data: T;
}

// 泛型请求函数
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json: Response<T> = await res.json();

  if (json.code !== 0) {
    throw new Error(json.message);
  }

  return json.data;
}

// 使用：T 指定为具体类型，有完整的类型提示
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
user.email; // ✅ 类型是 string

const userList = await request<PaginatedList<User>>("/api/users");
userList.items[0].name; // ✅ 类型是 string
```

## 泛型约束（extends）

限制泛型必须包含某些属性：

```typescript
// T 必须有 length 属性
function printLength<T extends { length: number }>(value: T): number {
  return value.length;
}

printLength("hello"); // ✅ string 有 length
printLength([1, 2, 3]); // ✅ array 有 length
printLength(42); // ❌ number 没有 length
```

```typescript
// K 必须是 T 的键
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25, email: "alice@example.com" };

getProperty(user, "name"); // ✅ 返回类型 string
getProperty(user, "age"); // ✅ 返回类型 number
getProperty(user, "phone"); // ❌ 'phone' 不是 user 的键
```

## 泛型工具类型

TypeScript 内置了一些常用的泛型工具：

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial：所有属性变为可选
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; password?: string }

// Required：所有属性变为必须
type RequiredUser = Required<PartialUser>;

// Pick：只保留指定属性
type UserProfile = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

// Omit：排除指定属性
type SafeUser = Omit<User, "password">;
// { id: number; name: string; email: string }

// Readonly：所有属性变为只读
type ReadonlyUser = Readonly<User>;

// Record：键值对类型
type UserMap = Record<string, User>;
// { [key: string]: User }
```

实际使用：

```typescript
// 更新用户时只传变化的字段
function updateUser(
  id: number,
  updates: Partial<Omit<User, "id">>,
): Promise<User> {
  return request(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

updateUser(1, { name: "Bob" }); // ✅ 只更新 name
updateUser(1, { id: 2 }); // ❌ id 不能更新（被 Omit 排除了）
```

## 在 Vue 组件中使用泛型

```typescript
// 通用列表组件
import Vue from "vue";

// Props 类型
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

## 小结

- 泛型让函数/类/接口适用于多种类型，同时保持类型安全
- `<T extends SomeType>` 约束泛型必须满足某些条件
- `keyof T` 获取类型的所有键，`T[K]` 获取具体属性类型
- `Partial`、`Pick`、`Omit` 等工具类型在实际开发中非常常用
