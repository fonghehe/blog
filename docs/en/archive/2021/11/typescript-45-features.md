---
title: "TypeScript 4.5 New Features: Pragmatic Improvements"
date: 2021-11-01 09:31:11
tags:
  - TypeScript

readingTime: 2
description: "Every TypeScript release from 4.1 to 4.5 brought practical improvements. Here are the features from those versions most worth learning — all usable in day-to-day development."
wordCount: 159
---

From TypeScript 4.1 through 4.5, every release has brought practical improvements. Here's a roundup of the most worthwhile features across these versions—the kind you'll actually use in day-to-day development.

## 4.1: Template Literal Types

This lets the type system operate on strings:

```typescript
// 事件处理器类型推断
type PropEventSource<T> = {
  on<K extends string & keyof T>
    (event: `${K}Changed`, callback: (newValue: T[K]) => void): void
}

declare function makeWatchedObject<T>(obj: T): T & PropEventSource<T>

const person = makeWatchedObject({ name: '张三', age: 25 })
// 自动推断回调参数类型
person.on('nameChanged', (newName) => {
  console.log(newName.toUpperCase()) // string
})
person.on('ageChanged', (newAge) => {
  console.log(newAge.toFixed(2)) // number
})

// 字符串操作类型
type Upper = Uppercase<'hello'>       // 'HELLO'
type Lower = Lowercase<'HELLO'>       // 'hello'
type Cap = Capitalize<'hello'>        // 'Hello'
type Uncap = Uncapitalize<'Hello'>    // 'hello'

// 实用场景：CSS 类名生成
type CSSClass<B extends string, M extends string> = `${B}--${M}`
type ButtonClass = CSSClass<'btn', 'primary'>  // 'btn--primary'
```

## 4.2: Smarter Type Alias Preservation

TypeScript now preserves type aliases in error messages instead of expanding them:

```typescript
// 以前的报错会显示展开后的完整类型
// 现在显示有意义的类型名称
type User = {
  id: number
  name: string
  role: 'admin' | 'user'
}

type ApiResponse<T> = {
  data: T
  code: number
  message: string
}

// 报错信息更友好：
// Type 'string' is not assignable to type 'ApiResponse<User>'
```

## 4.3: The `override` Keyword

```typescript
class Base {
  greet() {
    return 'Hello'
  }
}

class Derived extends Base {
  // 必须显式标记 override，否则编译报错
  override greet() {
    return 'Hi'
  }

  // 方法名拼写错误会报错
  // override greetd() {} // Error: not found in base class
}

// 需要在 tsconfig.json 中开启：
// { "compilerOptions": { "noImplicitOverride": true } }
```

This feature prevents a subclass method from becoming orphaned after a parent class renames the method.

## 4.4: Catch Variable Types

```typescript
// 以前 catch 变量默认是 unknown（strict 模式）或 any
try {
  await fetchData()
} catch (err) {
  // 以前：err 是 any，需要手动类型守卫
  // 4.4+：strict 模式下 err 是 unknown，更安全
  if (err instanceof TypeError) {
    console.log(err.message) // 这里 err 是 TypeError
  } else if (isNetworkError(err)) {
    console.log(err.code) // 自定义类型守卫
  }
}

// 自定义类型守卫
interface NetworkError {
  code: number
  message: string
}

function isNetworkError(err: unknown): err is NetworkError {
  return typeof err === 'object' && err !== null && 'code' in err
}
```

## 4.5: The `Awaited` Type and ES Module Support

```typescript
// Awaited 类型 - 递归解包 Promise
type A = Awaited<Promise<string>>                    // string
type B = Awaited<Promise<Promise<number>>>           // number
type C = Awaited<Promise<Promise<Promise<boolean>>>  // boolean

// 实用场景：工具函数返回类型
async function fetchUser() {
  return { id: 1, name: '张三' }
}

// 不需要手动 infer
type User = Awaited<ReturnType<typeof fetchUser>>
// { id: number, name: string }

// ES Module 支持 Node.js
// package.json
{
  "type": "module"
}
// 现在 .ts 文件可以用 import/export 语法
// tsconfig.json 中 "module": "ESNext"
```

## Version Selection Guide

```
TypeScript 4.1：模板字面量类型，必学
TypeScript 4.2：类型别名保留，升级即可
TypeScript 4.3：override 关键字，建议开启
TypeScript 4.4：catch 变量类型守卫，安全增强
TypeScript 4.5：Awaited 类型，异步工具函数必备
```

## Summary

- Template literal types are among the most powerful 4.x features, letting the type system work with strings
- The `override` keyword makes inheritance safer; consider enabling it project-wide
- The `Awaited` type simplifies typing async utility functions
- Each release's improvements are small, but together they significantly improve the TypeScript developer experience
- I'd recommend teams follow the latest versions—the upgrade cost is low but the payoff is high
