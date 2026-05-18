---
title: "TypeScript 4.4 新特性"
date: 2021-09-06 10:05:41
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 4.4 發佈了，幾個實用的改進值得關注。不是大版本，但有幾個對日常開發有實際幫助的特性。"
---

TypeScript 4.4 發佈了，幾個實用的改進值得關注。不是大版本，但有幾個對日常開發有實際幫助的特性。

## Control Flow Analysis for Aliased Conditions

之前 TypeScript 對變量別名的控制流分析很弱，4.4 改善了這一點。

```typescript
// 之前：把 result 賦給別名後，類型守衞失效
function process(value: string | number) {
  const isString = typeof value === 'string'
  if (isString) {
    // ❌ 之前報錯：value 還是 string | number
    // ✅ 4.4：正確推斷為 string
    console.log(value.toUpperCase())
  }
}

// 更實際的場景
function handleInput(input: string | null) {
  const isValid = input !== null

  if (isValid) {
    // ✅ 4.4 能識別：input 是 string
    console.log(input.length)
  }

  // 數組也行
  const items = getItems() // (string | number)[]
  const hasItems = items.length > 0

  if (hasItems) {
    // ✅ items 仍然有類型信息
    items.forEach(item => {
      if (typeof item === 'string') {
        console.log(item.toUpperCase())
      }
    })
  }
}
```

## `exactOptionalPropertyTypes`

這個選項解決了一個長期困擾的問題：可選屬性到底能不能賦值 `undefined`。

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true
  }
}

// 之前：
interface Config {
  name?: string
}

const c1: Config = { name: undefined } // 不報錯（但語義上不對）
const c2: Config = {}                  // 不報錯

// 開啓 exactOptionalPropertyTypes 後：
const c3: Config = { name: undefined } // ❌ 報錯！name 是 string | undefined
const c4: Config = {}                  // ✅ 可以省略

// 如果確實需要 undefined，要顯式聲明
interface Config {
  name?: string | undefined
}
```

這個選項讓 `undefined` 的語義更精確：可選屬性可以省略，但不能顯式賦 `undefined`。

## `switch(true)` 模式

```typescript
function describe(value: unknown): string {
  switch (true) {
    case typeof value === 'string':
      // ✅ 4.4：value 被收窄為 string
      return `字符串: ${value.length} 個字符`
    case typeof value === 'number':
      // ✅ value 被收窄為 number
      return `數字: ${value.toFixed(2)}`
    case Array.isArray(value):
      // ✅ value 被收窄為 unknown[]
      return `數組: ${value.length} 項`
    default:
      return '未知類型'
  }
}
```

## Symbol 和模板字符串類型

```typescript
// 模板字符串類型也可以用 symbol
declare const sym: unique symbol

// ✅ 4.4 支持
type T = typeof sym extends string ? never : typeof sym
```

## 性能改進

TypeScript 4.4 在多個方面優化了性能：

- 條件類型中的延遲類型推斷
- 交叉類型和聯合類型的處理優化
- `@types` 包的加載速度提升

實際體感：大型項目的 `tsc --noEmit` 速度快了 10-20%。

## 實用配置建議

```jsonc
// tsconfig.json 推薦配置（Vue 3 + Vite 項目）
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "exactOptionalPropertyTypes": true,     // 4.4 新增
    "noUncheckedIndexedAccess": true,       // 數組/對象索引訪問返回 T | undefined
    "noPropertyAccessFromIndexSignature": true,
    "jsx": "preserve",
    "importsNotUsedAsValues": "error",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

## 小結

- Control Flow Analysis for Aliased Conditions：變量賦值後類型守衞不再失效
- `exactOptionalPropertyTypes`：可選屬性不能顯式賦 `undefined`，語義更精確
- `switch(true)` 也能做類型收窄了
- 性能提升，大型項目感知明顯
- 建議開啓 `noUncheckedIndexedAccess` 配合使用，進一步提升類型安全