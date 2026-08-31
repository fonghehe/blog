---
title: "TypeScript 4.4 新機能"
date: 2021-09-06 10:05:41
tags:
  - TypeScript

readingTime: 2
description: "TypeScript 4.4 がリリースされた。いくつかの実用的な改善が注目に値する。メジャーバージョンではないが、日常の開発に実際に役立つ機能がいくつかある。"
wordCount: 458
---

TypeScript 4.4 がリリースされた。いくつかの実用的な改善が注目に値する。メジャー版ではないが、日常の開発に実際に役立つ機能がいくつかある。

## Control Flow Analysis for Aliased Conditions

以前の TypeScript は変数のエイリアスに対する制御フロー解析が弱かったが、4.4 で改善された。

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

このオプションは長年悩まされていた問題を解決する：オプショナルプロパティに `undefined` を代入できるかどうかだ。

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

このオプションにより `undefined` の意味論がより厳密になる：オプショナルプロパティは省略できるが、`undefined` を明示的に代入することはできない。

## `switch(true)` パターン

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

## Symbol とテンプレートリテラル型

```typescript
// 模板字符串类型也可以用 symbol
declare const sym: unique symbol

// ✅ 4.4 支持
type T = typeof sym extends string ? never : typeof sym
```

## パフォーマンス改善

TypeScript 4.4 在多个方面优化了性能：

- 条件类型中的延迟类型推断
- 交叉类型和联合类型的处理优化
- `@types` 包的加载速度提升

实际体感：大型项目的 `tsc --noEmit` 速度快了 10-20%。

## 実用的な設定のヒント

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

## まとめ

- Control Flow Analysis for Aliased Conditions：変数代入後も型ガードが失効しなくなった
- `exactOptionalPropertyTypes`：オプショナルプロパティに `undefined` を明示的に代入できず、意味論がより厳密に
- `switch(true)` でも型の絞り込みができるようになった
- パフォーマンスが向上し、大規模プロジェクトでの体感が明らかだ
- `noUncheckedIndexedAccess` を併用して有効にすることを推奨する。型安全性がさらに向上する。