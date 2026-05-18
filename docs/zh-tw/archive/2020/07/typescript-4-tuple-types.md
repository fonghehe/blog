---
title: "TypeScript 4.0 元組型別與可變引數元組"
date: 2020-07-20 10:53:30
tags:
  - TypeScript
readingTime: 3
description: "TypeScript 4.0 beta 剛釋出，這次最讓我興奮的是元組型別（Tuple Types）的大幅增強，特別是可變引數元組（Variadic Tuple Types）。以前處理函式引數組合、rest 引數拼接時，型別系統完全幫不上忙，現在終於可以優雅地表達了。"
---

TypeScript 4.0 beta 剛釋出，這次最讓我興奮的是元組型別（Tuple Types）的大幅增強，特別是可變引數元組（Variadic Tuple Types）。以前處理函式引數組合、rest 引數拼接時，型別系統完全幫不上忙，現在終於可以優雅地表達了。

## 回顧：固定長度的元組

以前 TypeScript 的元組型別是這樣的：

```typescript
// 固定長度、固定型別的元組
type Coordinate = [number, number]
type NameAge = [string, number]

const point: Coordinate = [10, 20]    // OK
const bad: Coordinate = [10]          // Error: 元素數量不匹配
const bad2: Coordinate = [10, 20, 30] // Error
```

## 新特性：可選和剩餘元素

TypeScript 4.0 允許在元組中標記可選元素和剩餘元素：

```typescript
// 可選元素
type FlexString = [string, string?, string?]

const a: FlexString = ['hello']
const b: FlexString = ['hello', 'world']
const c: FlexString = ['hello', 'world', '!']

// 剩餘元素 —— 必須放在末尾
type AtLeastTwo<T> = [T, T, ...T[]]

const d: AtLeastTwo<number> = [1, 2]
const e: AtLeastTwo<number> = [1, 2, 3, 4, 5]

// 混合使用
type NamedArgs = [string, number, ...string[]]

const f: NamedArgs = ['config', 42]
const g: NamedArgs = ['config', 42, 'extra1', 'extra2']
```

## 前置和中置剩餘元素

TypeScript 4.0 還支援把剩餘元素放在開頭或中間，而不只是末尾：

```typescript
// 剩餘元素在開頭
type WithHead = [...string[], number]

const x: WithHead = [1]                    // OK
const y: WithHead = ['a', 'b', 3]          // OK
const z: WithHead = ['a', 'b', 'c']        // Error: 最後一個必須是 number

// 剩餘元素在中間
type Middle = [string, ...number[], string]

const m1: Middle = ['hello', 'world']      // OK
const m2: Middle = ['hello', 1, 2, 3, 'world'] // OK
const m3: Middle = ['hello', 1, 2]         // OK
```

## 可變引數元組：型別安全的引數拼接

這是 TypeScript 4.0 最重要的特性。用泛型來表達元組的拼接、合併等操作：

```typescript
// 型別安全的 concat
function concat<T extends unknown[], U extends unknown[]>(
  arr1: [...T],
  arr2: [...U]
): [...T, ...U] {
  return [...arr1, ...arr2]
}

// TypeScript 能正確推斷出返回型別
const result = concat([1, 2], ['a', 'b'])
//    ^? [number, number, string, string]

result[0] // number
result[2] // string
result[4] // Error: 越界
```

## 實戰：型別安全的 curry 實現

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
// const bad = curriedAdd('1')      // Error: 'string' 不能賦值給 'number'
```

## 實戰：型別安全的事件系統

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
  // userId: string, timestamp: number — 型別自動推斷
  console.log(`使用者 ${userId} 在 ${timestamp} 登入`)
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

## 實戰：型別安全的中介軟體管道

```typescript
// 用元組型別表達中介軟體的輸入輸出鏈
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

// 定義中介軟體
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

TypeScript 4.0 允許給元組元素加標籤，提高可讀性：

```typescript
// 沒有標籤 —— 靠註釋才能理解
type Range = [number, number]

// 有標籤 —— 自解釋
type Range2 = [start: number, end: number]
type HttpResponse = [status: number, body: string, headers: Record<string, string>]

// 在函式返回值中也生效
function getPageBounds(page: number, size: number): [start: number, end: number] {
  return [page * size, (page + 1) * size - 1]
}

const [start, end] = getPageBounds(2, 10) // 智慧提示會顯示標籤名
```

## 小結

- TypeScript 4.0 元組支援可選元素（`T?`）和剩餘元素（`...T[]`）
- 剩餘元素可以出現在元組的任意位置，不侷限於末尾
- 可變引數元組允許在泛型中拼接、操作元組型別
- Labeled Tuple Elements 提高了元組的可讀性
- 這些特性讓函數語言程式設計、中介軟體管道等模式的型別推斷變得可能
- 對於需要處理動態引數組合的庫作者來說，這是質的飛躍
