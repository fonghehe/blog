---
title: "TypeScript 4.2 New Features"
date: 2021-03-22 17:22:02
tags:
  - TypeScript

readingTime: 2
description: "TypeScript 4.2 shipped at the end of February with a set of practical type-system improvements. Here are the features that affect daily development the most."
wordCount: 204
---

TypeScript 4.2 was released at the end of February, bringing several practical type-system improvements. Let's look at the features that have the biggest impact on day-to-day development.

## Named Tuple Elements

Previously, tuple types could only be written like this:

```typescript
// 以前：只能用位置来理解含义
type Args = [string, number, boolean]
// 不看文档完全不知道每个位置是什么

function processArgs(...args: [string, number, boolean]) {
  const name = args[0]    // string
  const count = args[1]   // number
  const flag = args[2]    // boolean
}
```

TypeScript 4.2 lets you name tuple elements:

```typescript
// 4.2：元组元素可以命名
type Args = [name: string, count: number, flag: boolean]

function processArgs(...args: [name: string, count: number, flag: boolean]) {
  const [name, count, flag] = args
  // IDE 提示更清晰
}
```

For library authors, this noticeably improves the readability of API signatures:

```typescript
// 实际场景：事件处理函数的参数
type EventHandler = [
  event: MouseEvent,
  data: { id: string; type: string },
  callback: (result: boolean) => void
]

// 解构时名称保留
function handleMouseEvent(...[event, data, callback]: EventHandler) {
  console.log(event.clientX, data.id)
  callback(true)
}
```

## Smarter Type Alias Expansion

Previously, TypeScript sometimes displayed the intermediate alias name when expanding a type alias; now it expands correctly to the final type:

```typescript
type ApiSuccess<T> = {
  code: 200
  data: T
  message: 'success'
}

type ApiError = {
  code: 400 | 500
  message: string
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

// 以前 hover 可能显示：ApiResponse<User>
// 4.2 hover 显示：ApiSuccess<User> | ApiError
// 更清晰
```

## `abstract` Construct Signatures

TypeScript 4.2 supports `abstract` construct signatures, letting you constrain a type to require an abstract class:

```typescript
abstract class Animal {
  abstract makeSound(): void
}

class Dog extends Animal {
  makeSound() { console.log('Woof') }
}

class Cat extends Animal {
  makeSound() { console.log('Meow') }
}

// 以前：无法在类型中约束为 abstract
function createAnimal(ctor: new () => Animal) {
  return new ctor()
}

// 4.2：可以用 abstract 约束
function createAnimal(ctor: abstract new () => Animal) {
  // 这样就不能传 Animal 本身了（它是 abstract 的）
  // 只能传 Dog、Cat 这样的具体子类
  return new ctor()
}

// ❌ createAnimal(Animal) // Animal 不能实例化
// ✅ createAnimal(Dog)    // OK
// ✅ createAnimal(Cat)    // OK
```

In framework design, this feature helps enforce that a concrete implementation class is passed in:

```typescript
// DI 容器的场景
abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T>
  abstract save(entity: T): Promise<void>
}

class Container {
  private factories = new Map<string, abstract new () => BaseRepository<any>>()

  register<T>(key: string, ctor: abstract new () => BaseRepository<T>) {
    this.factories.set(key, ctor)
  }
}
```

## `--noPropertyAccessFromIndexSignature`

This compiler option fixes a long-standing 'too lenient' problem in TypeScript:

```typescript
interface Config {
  host: string
  port: number
  [key: string]: string | number
}

const config: Config = { host: 'localhost', port: 3000 }

// 默认行为：两种访问方式都允许
config.host        // string — OK
config['host']     // string — OK
config.timeout     // string | number — 无报错，但可能是笔误

// 开启 --noPropertyAccessFromIndexSignature 后
config.host        // ✅ OK，显式声明的属性
config['host']     // ✅ OK，显式用方括号表示你清楚在访问索引签名
config.timeout     // ❌ 报错！不是显式声明的属性
config['timeout']  // ✅ OK，用方括号明确表示你知道这是索引签名
```

In real projects this option is very useful—it catches typos without losing the flexibility of index signatures:

```typescript
// 拼写错误会被捕获
config.hots // ❌ Error: Property 'hots' does not exist

// 如果确实需要动态访问，用方括号
config[dynamicKey] // ✅ OK
```

## Improvements to Type Inference

TypeScript 4.2 infers more accurately in conditional types:

```typescript
// 更精确的元组类型推断
function tail<T extends any[]>(arr: readonly [any, ...T]): T {
  return arr.slice(1) as T
}

const result = tail([1, 'hello', true])
// 推断为 [string, boolean]，而不是 (string | boolean)[]
```

## Summary

- Naming tuple elements makes API signatures more readable, and library authors benefit the most
- `abstract` construct signatures have real use in frameworks and DI scenarios
- Enable `--noPropertyAccessFromIndexSignature` in new projects to catch typos
- Every TypeScript release makes the type system more precise; it's worth keeping up