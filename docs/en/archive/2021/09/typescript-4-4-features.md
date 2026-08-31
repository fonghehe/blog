---
title: "TypeScript 4.4 New Features"
date: 2021-09-06 10:05:41
tags:
  - TypeScript

readingTime: 2
description: "TypeScript 4.4 is out, with several practical improvements worth watching. It's not a major release, but a few features genuinely help day-to-day development."
wordCount: 183
---

TypeScript 4.4 has been released, and a few practical improvements are worth noting. It's not a major version, but it ships several features that genuinely help day-to-day development.

## Control Flow Analysis for Aliased Conditions

Previously TypeScript's control-flow analysis for aliased variables was weak; 4.4 improves on this.

```typescript
// 之前：把 result 赋给别名后，类型守卫失效
function process(value: string | number) {
  const isString = typeof value === 'string'
  if (isString) {
    // ❌ 之前报错：value 还是 string | number
    // ✅ 4.4：正确推断为 string
    console.log(value.toUpperCase())
  }
}

// 更实际的场景
function handleInput(input: string | null) {
  const isValid = input !== null

  if (isValid) {
    // ✅ 4.4 能识别：input 是 string
    console.log(input.length)
  }

  // 数组也行
  const items = getItems() // (string | number)[]
  const hasItems = items.length > 0

  if (hasItems) {
    // ✅ items 仍然有类型信息
    items.forEach(item => {
      if (typeof item === 'string') {
        console.log(item.toUpperCase())
      }
    })
  }
}
```

## `exactOptionalPropertyTypes`

This option solves a long-standing headache: whether an optional property can be assigned `undefined`.

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

const c1: Config = { name: undefined } // 不报错（但语义上不对）
const c2: Config = {}                  // 不报错

// 开启 exactOptionalPropertyTypes 后：
const c3: Config = { name: undefined } // ❌ 报错！name 是 string | undefined
const c4: Config = {}                  // ✅ 可以省略

// 如果确实需要 undefined，要显式声明
interface Config {
  name?: string | undefined
}
```

This option makes the semantics of `undefined` more precise: an optional property can be omitted, but it can't be explicitly assigned `undefined`.

## The `switch(true)` Pattern

```typescript
function describe(value: unknown): string {
  switch (true) {
    case typeof value === 'string':
      // ✅ 4.4：value 被收窄为 string
      return `字符串: ${value.length} 个字符`
    case typeof value === 'number':
      // ✅ value 被收窄为 number
      return `数字: ${value.toFixed(2)}`
    case Array.isArray(value):
      // ✅ value 被收窄为 unknown[]
      return `数组: ${value.length} 项`
    default:
      return '未知类型'
  }
}
```

## Symbols and Template Literal Types

```typescript
// 模板字符串类型也可以用 symbol
declare const sym: unique symbol

// ✅ 4.4 支持
type T = typeof sym extends string ? never : typeof sym
```

## Performance Improvements

TypeScript 4.4 improves performance in several areas:

- Lazy type inference in conditional types
- Optimized handling of intersection and union types
- Faster loading of `@types` packages

In practice: on large projects, `tsc --noEmit` runs 10–20% faster.

## Practical Configuration Tips

```jsonc
// tsconfig.json 推荐配置（Vue 3 + Vite 项目）
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "exactOptionalPropertyTypes": true,     // 4.4 新增
    "noUncheckedIndexedAccess": true,       // 数组/对象索引访问返回 T | undefined
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

## Summary

- Control Flow Analysis for Aliased Conditions: type guards no longer break after assignment.
- `exactOptionalPropertyTypes`: optional properties can't be explicitly assigned `undefined`, making the semantics more precise.
- `switch(true)` can now also narrow types.
- Performance improvements are noticeable on large projects.
- I recommend enabling `noUncheckedIndexedAccess` alongside it to further improve type safety.