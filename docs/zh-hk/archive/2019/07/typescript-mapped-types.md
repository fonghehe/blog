---
title: "TypeScript 映射類型深入"
date: 2019-07-25 16:35:13
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 的類型系統非常強大，映射類型（Mapped Types）是其中最實用的特性之一。它允許你基於已有類型創建新類型，批量修改屬性的修飾符。這篇文章從基礎到實戰，把映射類型講清楚。"
wordCount: 479
---

TypeScript 的類型系統非常強大，映射類型（Mapped Types）是其中最實用的特性之一。它允許你基於已有類型創建新類型，批量修改屬性的修飾符。這篇文章從基礎到實戰，把映射類型講清楚。

## 基礎語法

映射類型的核心語法：

```typescript
type MappedType<T> = {
  [K in keyof T]: T[K]
}
```

- `keyof T`：獲取 T 的所有鍵，返回聯合類型
- `K in keyof T`：遍歷每個鍵
- `T[K]`：獲取 T 中鍵 K 對應的類型（索引訪問類型）

看一個最簡單的例子：

```typescript
interface User {
  id: number
  name: string
  email: string
  age: number
}

// 把所有屬性變為 string 類型
type StringifyUser = {
  [K in keyof User]: string
}
// 等價於：
// {
//   id: string
//   name: string
//   email: string
//   age: string
// }
```

## 只讀修飾符：readonly +/- 

加號 `+` 表示添加修飾符（默認行為，可省略），減號 `-` 表示移除修飾符：

```typescript
// 添加 readonly（所有屬性變為只讀）
type ReadonlyUser = {
  readonly [K in keyof User]: User[K]
}
// 等價於：
// interface ReadonlyUser {
//   readonly id: number
//   readonly name: string
//   readonly email: string
//   readonly age: number
// }

// 移除 readonly
type MutableUser = {
  -readonly [K in keyof ReadonlyUser]: ReadonlyUser[K]
}

// TypeScript 內置的 Readonly<T> 就是這樣實現的：
// type Readonly<T> = {
//   readonly [P in keyof T]: T[P]
// }
```

## 可選性修飾符：? +/- 

```typescript
// 所有屬性變為可選
type PartialUser = {
  [K in keyof User]?: User[K]
}
// 等價於內置的 Partial<T>

// 移除可選性（所有屬性變為必填）
type RequiredUser = {
  [K in keyof PartialUser]-?: PartialUser[K]
}
// 等價於內置的 Required<T>
```

## 與條件類型結合

映射類型配合條件類型可以做更精確的類型變換：

```typescript
// 只把函數類型的屬性提取出來
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

interface Api {
  baseUrl: string
  timeout: number
  getUsers: () => Promise<User[]>
  deleteUser: (id: number) => Promise<void>
  version: string
}

type ApiFunctionKeys = FunctionKeys<Api>
// "getUsers" | "deleteUser"
```

```typescript
// 把所有方法的返回值類型提取出來
type ReturnTypes<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => infer R ? R : never
}

type ApiReturnTypes = ReturnTypes<Api>
// {
//   baseUrl: never
//   timeout: never
//   getUsers: Promise<User[]>
//   deleteUser: Promise<void>
//   version: never
// }
```

```typescript
// 只保留函數屬性
type PickFunctions<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}
// 注意：as 語法在 TS 4.1+ 中可用，3.x 中需要用不同的方式
```

## 實戰：實現常用工具類型

### DeepPartial — 深層可選

內置的 `Partial` 只處理第一層，嵌套對象不會被處理：

```typescript
interface Config {
  database: {
    host: string
    port: number
    credentials: {
      username: string
      password: string
    }
  }
  cache: {
    ttl: number
    maxSize: number
  }
}

// Partial<Config> 只能讓 database 和 cache 可選
// 但 database.host、database.port 還是必填

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepPartial<T[K]>
    : T[K]
}

// 使用
const partialConfig: DeepPartial<Config> = {
  database: {
    host: 'localhost'
    // port、credentials 都可以省略
  }
  // cache 也可以省略
}
```

### DeepReadonly — 深層只讀

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K]
}

const config: DeepReadonly<Config> = getConfig()
config.database.host = 'new-host' // 報錯：只讀
config.database = { host: 'new', port: 3306 } // 報錯：只讀
```

### Record 的實現

`Record<K, V>` 是 TypeScript 內置的工具類型，把聯合類型 K 映射為值類型 V：

```typescript
// 內置實現
type Record<K extends keyof any, T> = {
  [P in K]: T
}

// 使用
type Status = 'pending' | 'processing' | 'completed' | 'failed'

const statusLabels: Record<Status, string> = {
  pending: '待處理',
  processing: '處理中',
  completed: '已完成',
  failed: '已失敗'
}
// 如果缺少任何一個狀態，TypeScript 會報錯
```

### Pick 和 Omit 的實現

```typescript
// Pick：從 T 中選取指定的屬性
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

type UserBasic = Pick<User, 'id' | 'name'>
// { id: number, name: string }

// Omit：從 T 中排除指定的屬性
type MyOmit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

type UserWithoutAge = Omit<User, 'age'>
// { id: number, name: string, email: string }
```

## 實戰：API 響應類型生成

實際項目中，後端 API 返回的數據往往有統一的包裝結構：

```typescript
// API 響應的統一結構
interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 用户相關的數據類型
interface UserData {
  id: number
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

// 使用
async function getUser(id: number): Promise<ApiResponse<UserData>> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// 如果想要剝離包裝，只取 data 部分：
type UnwrapResponse<T> = T extends ApiResponse<infer U> ? U : T

async function getUserData(id: number): Promise<UserData> {
  const res = await getUser(id)
  return res.data
}
```

## 實戰：Vuex/Redux Action 類型生成

從 action 處理函數自動生成 action 類型：

```typescript
// 定義 action handlers
const userActions = {
  SET_USER(state: UserState, user: User) {
    state.user = user
  },
  SET_LOADING(state: UserState, loading: boolean) {
    state.loading = loading
  },
  SET_ERROR(state: UserState, error: string | null) {
    state.error = error
  }
}

// 提取 action 名稱
type ActionNames = keyof typeof userActions
// "SET_USER" | "SET_LOADING" | "SET_ERROR"

// 提取每個 action 的 payload 類型
type ActionPayloads = {
  [K in ActionNames]: Parameters<typeof userActions[K]>[1]
}
// {
//   SET_USER: User
//   SET_LOADING: boolean
//   SET_ERROR: string | null
// }
```

## 踩坑記錄

### 坑 1：遞歸類型導致無限循環

```typescript
// 遞歸深度太大時 TypeScript 可能報錯
type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]> // 無限遞歸的類型
}

// 解決：加上函數類型判斷的終止條件
type DeepPartial<T> = T extends Function
  ? T
  : {
      [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
    }
```

### 坑 2：映射類型丟失方法簽名

```typescript
interface Service {
  data: string
  getData(): string
}

type Wrapped = {
  [K in keyof Service]: Service[K]
}
// getData 的類型會被保留為 () => string
// 但如果用了泛型變換（如變為 Promise 包裹），需要注意方法類型
```

### 坑 3：索引簽名的處理

```typescript
interface Dictionary {
  [key: string]: number
}

type ReadonlyDict = Readonly<Dictionary>
// 索引簽名會被保留：readonly [key: string]: number
```

## 小結

- 映射類型的核心語法：`[K in keyof T]: T[K]`
- `readonly` 和 `?` 修飾符可以用 `+` 添加、`-` 移除
- 映射類型 + 條件類型 = 強大的類型變換能力
- `Partial`、`Required`、`Readonly`、`Pick`、`Omit`、`Record` 都基於映射類型實現
- `DeepPartial`、`DeepReadonly` 等遞歸類型要注意終止條件
- 實際項目中常用於 API 類型生成、狀態管理類型推導等場景
