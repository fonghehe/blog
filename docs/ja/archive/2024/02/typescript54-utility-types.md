---
title: "TypeScript 5.4：NoIntrinsic、Object.groupBy と型推論強化"
date: 2024-02-06 10:05:36
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.4 正式发布，带来了一些实用的类型系统改进和对 TC39 新提案的支持。从架构视角看，有几个特性对团队代码质量提升明显。"
---

TypeScript 5.4 正式发布，带来了一些实用的类型系统改进和对 TC39 新提案的支持。从架构视角看，有几个特性对团队代码质量提升明显。

## Object.groupBy と Map.groupBy

之前分组操作需要写 reduce：

```typescript
// 以前：手写 reduce
const grouped = users.reduce((acc, user) => {
  const key = user.role;
  if (!acc[key]) acc[key] = [];
  acc[key].push(user);
  return acc;
}, {} as Record<string, User[]>);

// TypeScript 5.4 + ES2024
const grouped = Object.groupBy(users, (user) => user.role);
// grouped 的类型是 Partial<Record<string, User[]>>
```

返回 `Partial` 是合理的，因为分组结果可能不包含所有可能的 key。

`Map.groupBy` 则返回 `Map<K, V[]>`，支持任意类型作为 key：

```typescript
const byDept = Map.groupBy(users, (u) => departments.get(u.deptId)!);
// 返回 Map<Department, User[]>
```

## NoIntrinsic 型安全強化

TypeScript 5.4 引入了 `NoIntrinsic` 类型，这是对模板字面量类型的增强。在处理 HTML 属性映射时更精确：

```typescript
// 类型推断更精准，条件类型中交叉类型分发更正确
type ExtractId<T> = T extends `${infer Prefix}_${infer Suffix}`
  ? `${Prefix}_id`
  : never;

type Result = ExtractId<"user_name" | "post_title">;
// "user_id" | "post_id"
```

## クロージャの型絞り込みの改善

一个很实用的改进：闭包中捕获的变量现在能正确保持类型缩小：

```typescript
function processValue(input: string | number) {
  if (typeof input === "string") {
    // TS 5.4 之前：闭包中 input 可能丢失 string 类型
    const handler = () => {
      return input.toUpperCase(); // 现在能正确识别为 string
    };
  }
}
```

## in 演算子による型絞り込みの強化

```typescript
interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function handlePet(pet: Dog | Cat) {
  if ("bark" in pet) {
    pet.bark(); // TS 5.4 之前这里可能不够精确
  }
}
```

## プロジェクトへの導入

我们团队在升级 TS 5.4 时，重点关注了几个场景：

1. **数据处理层**：把自定义 groupBy 工具函数替换为原生 `Object.groupBy`，减少约 200 行重复代码
2. **类型安全**：利用改进的条件类型推断，简化了 API 响应类型的自动推导
3. **团队规范**：更新 ESLint 规则，检测并标记可以使用原生 API 的地方

## まとめ

- `Object.groupBy` / `Map.groupBy`：原生分组 API，减少重复工具函数
- 闭包类型缩小：闭包中捕获的变量保持类型信息
- `in` 运算符增强：更精确的类型收窄
- 条件类型推断改进：交叉类型处理更准确
- 建议团队统一升级，配合 `target: "ES2024"` 使用