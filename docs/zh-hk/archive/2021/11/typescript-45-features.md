---
title: "TypeScript 4.5 新特性：實用主義的改進"
date: 2021-11-01 09:31:11
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 從 4.1 到 4.5 每個版本都有實用的改進。整理一下這幾個版本中最值得學習的特性，都是日常開發中能用到的。"
---

TypeScript 從 4.1 到 4.5 每個版本都有實用的改進。整理一下這幾個版本中最值得學習的特性，都是日常開發中能用到的。

## 4.1：模板字面量類型

讓類型系統能操作字符串：

```typescript
// 事件處理器類型推斷
type PropEventSource<T> = {
  on<K extends string & keyof T>
    (event: `${K}Changed`, callback: (newValue: T[K]) => void): void
}

declare function makeWatchedObject<T>(obj: T): T & PropEventSource<T>

const person = makeWatchedObject({ name: '張三', age: 25 })
// 自動推斷回調參數類型
person.on('nameChanged', (newName) => {
  console.log(newName.toUpperCase()) // string
})
person.on('ageChanged', (newAge) => {
  console.log(newAge.toFixed(2)) // number
})

// 字符串操作類型
type Upper = Uppercase<'hello'>       // 'HELLO'
type Lower = Lowercase<'HELLO'>       // 'hello'
type Cap = Capitalize<'hello'>        // 'Hello'
type Uncap = Uncapitalize<'Hello'>    // 'hello'

// 實用場景：CSS 類名生成
type CSSClass<B extends string, M extends string> = `${B}--${M}`
type ButtonClass = CSSClass<'btn', 'primary'>  // 'btn--primary'
```

## 4.2：Smarter Type Alias Preservation

TypeScript 在報錯信息中保留類型別名，不再展開：

```typescript
// 以前的報錯會顯示展開後的完整類型
// 現在顯示有意義的類型名稱
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

// 報錯信息更友好：
// Type 'string' is not assignable to type 'ApiResponse<User>'
```

## 4.3：override 關鍵字

```typescript
class Base {
  greet() {
    return 'Hello'
  }
}

class Derived extends Base {
  // 必須顯式標記 override，否則編譯報錯
  override greet() {
    return 'Hi'
  }

  // 方法名拼寫錯誤會報錯
  // override greetd() {} // Error: not found in base class
}

// 需要在 tsconfig.json 中開啓：
// { "compilerOptions": { "noImplicitOverride": true } }
```

這個特性避免了父類改名後子類方法變成孤立方法的問題。

## 4.4：Catch 變量類型

```typescript
// 以前 catch 變量默認是 unknown（strict 模式）或 any
try {
  await fetchData()
} catch (err) {
  // 以前：err 是 any，需要手動類型守衞
  // 4.4+：strict 模式下 err 是 unknown，更安全
  if (err instanceof TypeError) {
    console.log(err.message) // 這裏 err 是 TypeError
  } else if (isNetworkError(err)) {
    console.log(err.code) // 自定義類型守衞
  }
}

// 自定義類型守衞
interface NetworkError {
  code: number
  message: string
}

function isNetworkError(err: unknown): err is NetworkError {
  return typeof err === 'object' && err !== null && 'code' in err
}
```

## 4.5：Awaited 類型和 ES Module 支持

```typescript
// Awaited 類型 - 遞歸解包 Promise
type A = Awaited<Promise<string>>                    // string
type B = Awaited<Promise<Promise<number>>>           // number
type C = Awaited<Promise<Promise<Promise<boolean>>>  // boolean

// 實用場景：工具函數返回類型
async function fetchUser() {
  return { id: 1, name: '張三' }
}

// 不需要手動 infer
type User = Awaited<ReturnType<typeof fetchUser>>
// { id: number, name: string }

// ES Module 支持 Node.js
// package.json
{
  "type": "module"
}
// 現在 .ts 文件可以用 import/export 語法
// tsconfig.json 中 "module": "ESNext"
```

## 版本選擇建議

```
TypeScript 4.1：模板字面量類型，必學
TypeScript 4.2：類型別名保留，升級即可
TypeScript 4.3：override 關鍵字，建議開啓
TypeScript 4.4：catch 變量類型守衞，安全增強
TypeScript 4.5：Awaited 類型，異步工具函數必備
```

## 小結

- 模板字面量類型是 4.x 最強大的特性之一，讓類型系統能操作字符串
- `override` 關鍵字讓繼承更安全，建議全局開啓
- `Awaited` 類型簡化了異步工具函數的類型編寫
- 每個版本的改進都不大，但累積起來讓 TypeScript 開發體驗顯著提升
- 建議團隊跟隨最新版本，升級成本低但收益高