---
title: "TypeScript 5.6: Iterator Helpers, Regex Types, and Strict Built-in Checks"
date: 2024-09-22 10:00:00
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.6 正式发布，带来了一些实用的语言特性和类型检查增强。挑几个对日常开发影响最大的变化。"
---

TypeScript 5.6 正式发布，带来了一些实用的语言特性和类型检查增强。挑几个对日常开发影响最大的变化。

## Iterator Helpers

对迭代器的原生支持，可以在 `for...of` 和生成器上直接链式操作：

```typescript
// 以前：需要转数组再处理
const users = Array.from(getAllUsers());
const activeEmails = users
  .filter((u) => u.isActive)
  .map((u) => u.email);

// TypeScript 5.6 + ES2024 Iterator Helpers
const activeEmails = getAllUsers()
  .filter((u) => u.isActive)
  .map((u) => u.email);
// 返回 Iterator，不创建中间数组
```

支持的方法：`map`、`filter`、`take`、`drop`、`flatMap`、`reduce`、`toArray`、`forEach`、`some`、`every`、`find`。

```typescript
// 实用场景：大文件逐行处理
function* readLines(content: string) {
  for (const line of content.split("\n")) {
    yield line;
  }
}

const errors = readLines(hugeLog)
  .filter((line) => line.includes("ERROR"))
  .take(10)    // 只取前 10 条
  .toArray();  // 转成数组

// 配合 async 迭代器
async function* fetchPages() {
  let page = 0;
  while (true) {
    const data = await fetch(`/api/items?page=${page++}`).then((r) => r.json());
    if (data.items.length === 0) return;
    yield* data.items;
  }
}

const first100 = fetchPages()
  .take(100)
  .toArray();
```

## RegExp Type Checking

`RegExp` 类型现在支持通过泛型标注捕获组：

```typescript
// 以前：exec 的结果是 RegExpExecArray | null，捕获组类型丢失
const match = /user-(\d+)/.exec("user-42");
// match[1] 是 string，没有自动类型

// TypeScript 5.6：可以标注捕获组
function parseRoute(path: string) {
  const match = /^\/users\/(?<id>\d+)\/posts\/(?<postId>\d+)$/.exec(path);
  if (!match?.groups) return null;

  return {
    userId: match.groups.id,      // string
    postId: match.groups.postId,  // string
  };
}
```

## Prohibit Empty Property Declarations

之前容易写出无意义的空类型属性，现在会报错：

```typescript
// TypeScript 5.6 之前不会报错
interface Config {
  name: string;
  value: number;
  ; // 空语句，无意义
}

// TypeScript 5.6：编译报错
// Error: Empty property declaration
```

## Relative Path Completion Enhancement

在 monorepo 中，IDE 的路径补全更智能了：

```typescript
// 在 packages/ui/src/Button.tsx 中引用
// TS 5.6 会正确建议相对路径
import { formatPrice } from "../../utils/src/price";
```

## Control Flow Analysis Improvements

```typescript
function process(data: string | null) {
  // TS 5.6 能更好地理解函数调用中的类型守卫
  if (data !== null) {
    const trimmed = data.trim();
    // trimmed 自动识别为 string
    console.log(trimmed.toUpperCase());
  }
}
```

## Configuration Updates

```json
// tsconfig.json 新增选项
{
  "compilerOptions": {
    "target": "ES2024",        // 支持 Iterator Helpers
    "lib": ["ES2024", "DOM"],
    "noUncheckedSideEffectImports": true,  // 检查副作用导入
    "isolatedDeclarations": true          // 加速构建
  }
}
```

`isolatedDeclarations` 对 monorepo 构建速度提升很大，允许单独处理每个文件的声明生成。

## Upgrade Notes

1. 如果项目用了 Babel 编译 TS，确保 Babel 插件支持新的语法
2. `target: "ES2024"` 需要对应的 runtime 支持，或使用 polyfill
3. Iterator Helpers 的 polyfill 可以用 `core-js` 或 `@ungap/iterator-helpers`

## Summary

- Iterator Helpers：惰性迭代链，减少中间数组分配
- 正则类型增强：更好的捕获组类型推断
- `isolatedDeclarations`：monorepo 构建加速
- `noUncheckedSideEffectImports`：更严格的副作用导入检查
- 建议配合 `target: "ES2024"` 使用
