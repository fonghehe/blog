---
title: "TypeScript 4.2 新特性"
date: 2021-03-22 17:22:02
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.2 在 2 月底發佈，帶來了一些實用的類型系統改進。挑幾個對日常開發影響最大的特性説説。"
wordCount: 362
---

TypeScript 4.2 在 2 月底發佈，帶來了一些實用的類型系統改進。挑幾個對日常開發影響最大的特性説説。

## Rest 元組類型中的命名元素

之前元組類型只能這樣寫：

```typescript
// 以前：只能用位置來理解含義
type Args = [string, number, boolean]
// 不看文檔完全不知道每個位置是什麼

function processArgs(...args: [string, number, boolean]) {
  const name = args[0]    // string
  const count = args[1]   // number
  const flag = args[2]    // boolean
}
```

4.2 支持給元組元素命名：

```typescript
// 4.2：元組元素可以命名
type Args = [name: string, count: number, flag: boolean]

function processArgs(...args: [name: string, count: number, flag: boolean]) {
  const [name, count, flag] = args
  // IDE 提示更清晰
}
```

對於庫作者來説，API 簽名的可讀性提升很明顯：

```typescript
// 實際場景：事件處理函數的參數
type EventHandler = [
  event: MouseEvent,
  data: { id: string; type: string },
  callback: (result: boolean) => void
]

// 解構時名稱保留
function handleMouseEvent(...[event, data, callback]: EventHandler) {
  console.log(event.clientX, data.id)
  callback(true)
}
```

## 更智能的類型別名展開

以前某些情況下 TypeScript 展開類型別名時會顯示中間的引用名稱，現在能正確展開為最終類型了：

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

// 以前 hover 可能顯示：ApiResponse<User>
// 4.2 hover 顯示：ApiSuccess<User> | ApiError
// 更清晰
```

## `abstract` 構造簽名

TypeScript 4.2 支持 `abstract` 構造簽名，可以在類型約束中指定必須是抽象類：

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

// 以前：無法在類型中約束為 abstract
function createAnimal(ctor: new () => Animal) {
  return new ctor()
}

// 4.2：可以用 abstract 約束
function createAnimal(ctor: abstract new () => Animal) {
  // 這樣就不能傳 Animal 本身了（它是 abstract 的）
  // 只能傳 Dog、Cat 這樣的具體子類
  return new ctor()
}

// ❌ createAnimal(Animal) // Animal 不能實例化
// ✅ createAnimal(Dog)    // OK
// ✅ createAnimal(Cat)    // OK
```

在框架設計中，這個特性可以幫助強制要求傳入的具體實現類：

```typescript
// DI 容器的場景
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

這個編譯選項解決了 TypeScript 一個長期的"太寬鬆"問題：

```typescript
interface Config {
  host: string
  port: number
  [key: string]: string | number
}

const config: Config = { host: 'localhost', port: 3000 }

// 默認行為：兩種訪問方式都允許
config.host        // string — OK
config['host']     // string — OK
config.timeout     // string | number — 無報錯，但可能是筆誤

// 開啓 --noPropertyAccessFromIndexSignature 後
config.host        // ✅ OK，顯式聲明的屬性
config['host']     // ✅ OK，顯式用方括號表示你清楚在訪問索引簽名
config.timeout     // ❌ 報錯！不是顯式聲明的屬性
config['timeout']  // ✅ OK，用方括號明確表示你知道這是索引簽名
```

實際項目中這個選項非常有用——能發現拼寫錯誤，同時不喪失索引簽名的靈活性：

```typescript
// 拼寫錯誤會被捕獲
config.hots // ❌ Error: Property 'hots' does not exist

// 如果確實需要動態訪問，用方括號
config[dynamicKey] // ✅ OK
```

## 類型推斷的改進

4.2 在條件類型中的推斷更準確了：

```typescript
// 更精確的元組類型推斷
function tail<T extends any[]>(arr: readonly [any, ...T]): T {
  return arr.slice(1) as T
}

const result = tail([1, 'hello', true])
// 推斷為 [string, boolean]，而不是 (string | boolean)[]
```

## 小結

- 元組元素命名讓 API 簽名更可讀，庫作者尤其受益
- `abstract` 構造簽名在框架和 DI 場景中有實際用途
- `--noPropertyAccessFromIndexSignature` 建議在新項目中開啓，能捕獲拼寫錯誤
- TypeScript 每個版本都在讓類型系統更精確，保持跟進是值得的