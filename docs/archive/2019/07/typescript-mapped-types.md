---
title: "TypeScript 映射类型深入"
date: 2019-07-25 16:35:13
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 的类型系统非常强大，映射类型（Mapped Types）是其中最实用的特性之一。它允许你基于已有类型创建新类型，批量修改属性的修饰符。这篇文章从基础到实战，把映射类型讲清楚。"
---

TypeScript 的类型系统非常强大，映射类型（Mapped Types）是其中最实用的特性之一。它允许你基于已有类型创建新类型，批量修改属性的修饰符。这篇文章从基础到实战，把映射类型讲清楚。

## 基础语法

映射类型的核心语法：

```typescript
type MappedType<T> = {
  [K in keyof T]: T[K]
}
```

- `keyof T`：获取 T 的所有键，返回联合类型
- `K in keyof T`：遍历每个键
- `T[K]`：获取 T 中键 K 对应的类型（索引访问类型）

看一个最简单的例子：

```typescript
interface User {
  id: number
  name: string
  email: string
  age: number
}

// 把所有属性变为 string 类型
type StringifyUser = {
  [K in keyof User]: string
}
// 等价于：
// {
//   id: string
//   name: string
//   email: string
//   age: string
// }
```

## 只读修饰符：readonly +/- 

加号 `+` 表示添加修饰符（默认行为，可省略），减号 `-` 表示移除修饰符：

```typescript
// 添加 readonly（所有属性变为只读）
type ReadonlyUser = {
  readonly [K in keyof User]: User[K]
}
// 等价于：
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

// TypeScript 内置的 Readonly<T> 就是这样实现的：
// type Readonly<T> = {
//   readonly [P in keyof T]: T[P]
// }
```

## 可选性修饰符：? +/- 

```typescript
// 所有属性变为可选
type PartialUser = {
  [K in keyof User]?: User[K]
}
// 等价于内置的 Partial<T>

// 移除可选性（所有属性变为必填）
type RequiredUser = {
  [K in keyof PartialUser]-?: PartialUser[K]
}
// 等价于内置的 Required<T>
```

## 与条件类型结合

映射类型配合条件类型可以做更精确的类型变换：

```typescript
// 只把函数类型的属性提取出来
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
// 把所有方法的返回值类型提取出来
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
// 只保留函数属性
type PickFunctions<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}
// 注意：as 语法在 TS 4.1+ 中可用，3.x 中需要用不同的方式
```

## 实战：实现常用工具类型

### DeepPartial — 深层可选

内置的 `Partial` 只处理第一层，嵌套对象不会被处理：

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

// Partial<Config> 只能让 database 和 cache 可选
// 但 database.host、database.port 还是必填

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

### DeepReadonly — 深层只读

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K]
}

const config: DeepReadonly<Config> = getConfig()
config.database.host = 'new-host' // 报错：只读
config.database = { host: 'new', port: 3306 } // 报错：只读
```

### Record 的实现

`Record<K, V>` 是 TypeScript 内置的工具类型，把联合类型 K 映射为值类型 V：

```typescript
// 内置实现
type Record<K extends keyof any, T> = {
  [P in K]: T
}

// 使用
type Status = 'pending' | 'processing' | 'completed' | 'failed'

const statusLabels: Record<Status, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '已失败'
}
// 如果缺少任何一个状态，TypeScript 会报错
```

### Pick 和 Omit 的实现

```typescript
// Pick：从 T 中选取指定的属性
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

type UserBasic = Pick<User, 'id' | 'name'>
// { id: number, name: string }

// Omit：从 T 中排除指定的属性
type MyOmit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

type UserWithoutAge = Omit<User, 'age'>
// { id: number, name: string, email: string }
```

## 实战：API 响应类型生成

实际项目中，后端 API 返回的数据往往有统一的包装结构：

```typescript
// API 响应的统一结构
interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 用户相关的数据类型
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

// 如果想要剥离包装，只取 data 部分：
type UnwrapResponse<T> = T extends ApiResponse<infer U> ? U : T

async function getUserData(id: number): Promise<UserData> {
  const res = await getUser(id)
  return res.data
}
```

## 实战：Vuex/Redux Action 类型生成

从 action 处理函数自动生成 action 类型：

```typescript
// 定义 action handlers
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

// 提取 action 名称
type ActionNames = keyof typeof userActions
// "SET_USER" | "SET_LOADING" | "SET_ERROR"

// 提取每个 action 的 payload 类型
type ActionPayloads = {
  [K in ActionNames]: Parameters<typeof userActions[K]>[1]
}
// {
//   SET_USER: User
//   SET_LOADING: boolean
//   SET_ERROR: string | null
// }
```

## 踩坑记录

### 坑 1：递归类型导致无限循环

```typescript
// 递归深度太大时 TypeScript 可能报错
type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]> // 无限递归的类型
}

// 解决：加上函数类型判断的终止条件
type DeepPartial<T> = T extends Function
  ? T
  : {
      [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
    }
```

### 坑 2：映射类型丢失方法签名

```typescript
interface Service {
  data: string
  getData(): string
}

type Wrapped = {
  [K in keyof Service]: Service[K]
}
// getData 的类型会被保留为 () => string
// 但如果用了泛型变换（如变为 Promise 包裹），需要注意方法类型
```

### 坑 3：索引签名的处理

```typescript
interface Dictionary {
  [key: string]: number
}

type ReadonlyDict = Readonly<Dictionary>
// 索引签名会被保留：readonly [key: string]: number
```

## 小结

- 映射类型的核心语法：`[K in keyof T]: T[K]`
- `readonly` 和 `?` 修饰符可以用 `+` 添加、`-` 移除
- 映射类型 + 条件类型 = 强大的类型变换能力
- `Partial`、`Required`、`Readonly`、`Pick`、`Omit`、`Record` 都基于映射类型实现
- `DeepPartial`、`DeepReadonly` 等递归类型要注意终止条件
- 实际项目中常用于 API 类型生成、状态管理类型推导等场景
