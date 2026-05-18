---
title: "TypeScript 4.0 元组类型与可变参数元组"
date: 2020-07-20 10:53:30
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 4.0 beta 刚发布，这次最让我兴奋的是元组类型（Tuple Types）的大幅增强，特别是可变参数元组（Variadic Tuple Types）。以前处理函数参数组合、rest 参数拼接时，类型系统完全帮不上忙，现在终于可以优雅地表达了。"
---

TypeScript 4.0 beta 刚发布，这次最让我兴奋的是元组类型（Tuple Types）的大幅增强，特别是可变参数元组（Variadic Tuple Types）。以前处理函数参数组合、rest 参数拼接时，类型系统完全帮不上忙，现在终于可以优雅地表达了。

## 回顾：固定长度的元组

以前 TypeScript 的元组类型是这样的：

```typescript
// 固定长度、固定类型的元组
type Coordinate = [number, number]
type NameAge = [string, number]

const point: Coordinate = [10, 20]    // OK
const bad: Coordinate = [10]          // Error: 元素数量不匹配
const bad2: Coordinate = [10, 20, 30] // Error
```

## 新特性：可选和剩余元素

TypeScript 4.0 允许在元组中标记可选元素和剩余元素：

```typescript
// 可选元素
type FlexString = [string, string?, string?]

const a: FlexString = ['hello']
const b: FlexString = ['hello', 'world']
const c: FlexString = ['hello', 'world', '!']

// 剩余元素 —— 必须放在末尾
type AtLeastTwo<T> = [T, T, ...T[]]

const d: AtLeastTwo<number> = [1, 2]
const e: AtLeastTwo<number> = [1, 2, 3, 4, 5]

// 混合使用
type NamedArgs = [string, number, ...string[]]

const f: NamedArgs = ['config', 42]
const g: NamedArgs = ['config', 42, 'extra1', 'extra2']
```

## 前置和中置剩余元素

TypeScript 4.0 还支持把剩余元素放在开头或中间，而不只是末尾：

```typescript
// 剩余元素在开头
type WithHead = [...string[], number]

const x: WithHead = [1]                    // OK
const y: WithHead = ['a', 'b', 3]          // OK
const z: WithHead = ['a', 'b', 'c']        // Error: 最后一个必须是 number

// 剩余元素在中间
type Middle = [string, ...number[], string]

const m1: Middle = ['hello', 'world']      // OK
const m2: Middle = ['hello', 1, 2, 3, 'world'] // OK
const m3: Middle = ['hello', 1, 2]         // OK
```

## 可变参数元组：类型安全的参数拼接

这是 TypeScript 4.0 最重要的特性。用泛型来表达元组的拼接、合并等操作：

```typescript
// 类型安全的 concat
function concat<T extends unknown[], U extends unknown[]>(
  arr1: [...T],
  arr2: [...U]
): [...T, ...U] {
  return [...arr1, ...arr2]
}

// TypeScript 能正确推断出返回类型
const result = concat([1, 2], ['a', 'b'])
//    ^? [number, number, string, string]

result[0] // number
result[2] // string
result[4] // Error: 越界
```

## 实战：类型安全的 curry 实现

```typescript
type Curry<Args extends any[], Return> = Args extends [infer First, ...infer Rest]
  ? (arg: First) => Rest extends []
    ? Return
    : Curry<Rest, Return>
  : Return

function curry<Args extends any[], Return>(
  fn: (...args: Args) => Return
): Curry<Args, Return> {
  return function curried(this: any, ...args: any[]) {
    if (args.length >= fn.length) {
      return fn.apply(this, args as Args)
    }
    return ((...moreArgs: any[]) => curried.apply(this, [...args, ...moreArgs])) as any
  } as any
}

// 使用
function add(a: number, b: number, c: number) {
  return a + b + c
}

const curriedAdd = curry(add)
//    ^? (arg: number) => (arg: number) => (arg: number) => number

const result = curriedAdd(1)(2)(3) // 6
// const bad = curriedAdd('1')      // Error: 'string' 不能赋值给 'number'
```

## 实战：类型安全的事件系统

```typescript
type EventMap = {
  login: [userId: string, timestamp: number]
  logout: [userId: string]
  error: [code: number, message: string, details?: object]
}

class TypedEmitter<Events extends Record<string, any[]>> {
  private listeners = new Map<string, Set<Function>>()

  on<K extends keyof Events>(
    event: K,
    listener: (...args: Events[K]) => void
  ): this {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set())
    }
    this.listeners.get(event as string)!.add(listener)
    return this
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const handlers = this.listeners.get(event as string)
    if (!handlers || handlers.size === 0) return false
    handlers.forEach(fn => fn(...args))
    return true
  }

  off<K extends keyof Events>(
    event: K,
    listener: (...args: Events[K]) => void
  ): this {
    this.listeners.get(event as string)?.delete(listener)
    return this
  }
}

const emitter = new TypedEmitter<EventMap>()

emitter.on('login', (userId, timestamp) => {
  // userId: string, timestamp: number — 类型自动推断
  console.log(`用户 ${userId} 在 ${timestamp} 登录`)
})

emitter.on('error', (code, message, details) => {
  // code: number, message: string, details?: object
  console.error(`[${code}] ${message}`, details)
})

emitter.emit('login', 'u-123', Date.now())     // OK
emitter.emit('login', 'u-123', 'wrong')         // Error: 'string' 不是 'number'
emitter.emit('error', 404, 'Not Found')          // OK
emitter.emit('logout', 123)                      // Error: 'number' 不是 'string'
```

## 实战：类型安全的中间件管道

```typescript
// 用元组类型表达中间件的输入输出链
type Middleware<Ctx, In, Out> = (ctx: Ctx, input: In) => Out | Promise<Out>

type PipeContext<Ctx, Middlewares extends any[]> = Middlewares extends [
  Middleware<Ctx, infer In, infer Out>,
  ...infer Rest
]
  ? Rest extends [any, ...any[]]
    ? [Middleware<Ctx, In, Out>, ...PipeContext<Ctx, Rest>]
    : [Middleware<Ctx, In, Out>]
  : []

async function pipe<Ctx, In, Out>(
  ctx: Ctx,
  input: In,
  middlewares: [Middleware<Ctx, In, any>, ...Middleware<Ctx, any, any>[], Middleware<Ctx, any, Out>]
): Promise<Out> {
  let current: any = input
  for (const mw of middlewares) {
    current = await mw(ctx, current)
  }
  return current as Out
}

// 定义中间件
type Ctx = { user?: { id: string } }

const auth: Middleware<Ctx, Request, Request> = (ctx, req) => {
  if (!ctx.user) throw new Error('Unauthorized')
  return req
}

const parse: Middleware<Ctx, Request, object> = async (_ctx, req) => {
  return req.json()
}

const validate: Middleware<Ctx, object, object> = (_ctx, body) => {
  if (!body || typeof body !== 'object') throw new Error('Invalid body')
  return body
}
```

## Labeled Tuple Elements

TypeScript 4.0 允许给元组元素加标签，提高可读性：

```typescript
// 没有标签 —— 靠注释才能理解
type Range = [number, number]

// 有标签 —— 自解释
type Range2 = [start: number, end: number]
type HttpResponse = [status: number, body: string, headers: Record<string, string>]

// 在函数返回值中也生效
function getPageBounds(page: number, size: number): [start: number, end: number] {
  return [page * size, (page + 1) * size - 1]
}

const [start, end] = getPageBounds(2, 10) // 智能提示会显示标签名
```

## 小结

- TypeScript 4.0 元组支持可选元素（`T?`）和剩余元素（`...T[]`）
- 剩余元素可以出现在元组的任意位置，不局限于末尾
- 可变参数元组允许在泛型中拼接、操作元组类型
- Labeled Tuple Elements 提高了元组的可读性
- 这些特性让函数式编程、中间件管道等模式的类型推断变得可能
- 对于需要处理动态参数组合的库作者来说，这是质的飞跃
