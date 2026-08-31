---
title: "TypeScript 4.0 タプル型と可変長タプル"
date: 2020-07-20 10:53:30
tags:
  - TypeScript
readingTime: 4
description: "TypeScript 4.0 beta がリリースされたばかりだが、今回最も興奮したのはタプル型（Tuple Types）の大幅な強化、特に可変長タプル（Variadic Tuple Types）だ。以前は関数の引数の組み合わせや rest 引数の結合において型システムがまったく役に立たなかったが、ようやく美しく表現できるようになった。"
wordCount: 595
---

TypeScript 4.0 beta がリリースされたばかりだが、今回私がもっとも興奮したのはタプル型（Tuple Types）の大幅な強化、特に可変長タプル（Variadic Tuple Types）だ。以前は関数の引数の組み合わせや rest 引数の結合において、型システムがまったく役に立たなかったが、ようやく美しく表現できるようになった。

## おさらい：固定長タプル

以前の TypeScript のタプル型は次のようなものだった：

```typescript
// 固定长度、固定类型的元组
type Coordinate = [number, number]
type NameAge = [string, number]

const point: Coordinate = [10, 20]    // OK
const bad: Coordinate = [10]          // Error: 元素数量不匹配
const bad2: Coordinate = [10, 20, 30] // Error
```

## 新機能：オプションと残余要素

TypeScript 4.0 では、タプル内で省略可能な要素と残余（rest）要素をマークできるようになった：

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

## 先頭・中間への残余要素

TypeScript 4.0 は、残余要素を末尾だけでなく先頭や中間にも配置できることもサポートしている：

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

## 可変長タプル：型安全な引数スプレッド

これは TypeScript 4.0 でもっとも重要な特性だ。ジェネリクスを使ってタプルの連結やマージなどの操作を表現できる：

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

## 実践：型安全なカリー化の実装

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

## 実践：型安全なイベントシステム

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

## 実践：型安全なミドルウェアパイプライン

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

## ラベル付きタプル要素

TypeScript 4.0 では、タプル要素にラベルを付けて可読性を高められる：

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

## まとめ

- TypeScript 4.0 のタプルは省略可能要素（`T?`）と残余要素（`...T[]`）をサポートする
- 残余要素はタプルの任意の位置に配置でき、末尾に限らない
- 可変長タプルにより、ジェネリクス内でタプル型の結合や操作が可能になった
- Labeled Tuple Elements によりタプルの可読性が向上した
- これらの機能により、関数型プログラミングやミドルウェアパイプラインなどのパターンの型推論が可能になった
- 動的な引数の組み合わせを扱うライブラリ作者にとって、これは質的な飛躍である
