---
title: "TypeScript 4.4 新特性"
date: 2021-09-06 10:05:41
tags:
  - TypeScript
---

TypeScript 4.4 发布了，几个实用的改进值得关注。不是大版本，但有几个对日常开发有实际帮助的特性。

## Control Flow Analysis for Aliased Conditions

之前 TypeScript 对变量别名的控制流分析很弱，4.4 改善了这一点。

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

这个选项解决了一个长期困扰的问题：可选属性到底能不能赋值 `undefined`。

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

这个选项让 `undefined` 的语义更精确：可选属性可以省略，但不能显式赋 `undefined`。

## `switch(true)` 模式

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

## Symbol 和模板字符串类型

```typescript
// 模板字符串类型也可以用 symbol
declare const sym: unique symbol

// ✅ 4.4 支持
type T = typeof sym extends string ? never : typeof sym
```

## 性能改进

TypeScript 4.4 在多个方面优化了性能：

- 条件类型中的延迟类型推断
- 交叉类型和联合类型的处理优化
- `@types` 包的加载速度提升

实际体感：大型项目的 `tsc --noEmit` 速度快了 10-20%。

## 实用配置建议

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

## 小结

- Control Flow Analysis for Aliased Conditions：变量赋值后类型守卫不再失效
- `exactOptionalPropertyTypes`：可选属性不能显式赋 `undefined`，语义更精确
- `switch(true)` 也能做类型收窄了
- 性能提升，大型项目感知明显
- 建议开启 `noUncheckedIndexedAccess` 配合使用，进一步提升类型安全