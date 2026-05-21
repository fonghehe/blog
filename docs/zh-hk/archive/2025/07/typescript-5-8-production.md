---
title: "TypeScript 5.8 生產實踐：類型安全的邊界與代價"
date: 2025-07-23 10:00:00
tags:
  - TypeScript
  - 安全
readingTime: 2
description: "TypeScript 5.8 於 2025 年 2 月發佈（注：這裏指向實際項目中採用的版本）。經過幾個月的生產使用，來分享一些真實場景下 TypeScript 嚴格類型系統的實踐經驗——哪些新特性真正有用，哪些在大型項目中會帶來意外麻煩。"
wordCount: 337
---

TypeScript 5.8 於 2025 年 2 月發佈（注：這裏指向實際項目中採用的版本）。經過幾個月的生產使用，來分享一些真實場景下 TypeScript 嚴格類型系統的實踐經驗——哪些新特性真正有用，哪些在大型項目中會帶來意外麻煩。

## TypeScript 5.8 主要特性回顧

### 1. --erasableSyntaxOnly：為 Node.js 原生 TS 支持優化

Node.js 22+ 支持直接運行 `.ts` 文件（不生成 .js），但只支持"可擦除語法"（不允許 `enum`、`namespace` 等運行時語法）。TS 5.8 新增 `--erasableSyntaxOnly` 選項來檢測違規：

```json
// tsconfig.json（用於 Node.js 原生 TS 項目）
{
  "compilerOptions": {
    "erasableSyntaxOnly": true // 禁止 enum、namespace 等運行時語法
  }
}
```

```typescript
// ❌ 報錯：enum 不是可擦除語法
enum Status {
  Active,
  Inactive,
}

// ✅ 替代方案：const 對象 + 類型
const Status = {
  Active: "active",
  Inactive: "inactive",
} as const;
type Status = (typeof Status)[keyof typeof Status];

// ✅ 替代方案：string literal union
type Status = "active" | "inactive";
```

### 2. 條件類型中的 infer 改進

```typescript
// TS 5.8 之前：提取函數返回類型的 Promise 內層類型需要嵌套 infer
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type UnwrapAll<T> =
  T extends Promise<infer U>
    ? UnwrapAll<U> // 需要手動遞歸
    : T;

// TS 5.8：infer extends 語法更強大
type ExtractArrayItem<T> = T extends (infer Item)[]
  ? Item extends string
    ? `string:${Item}`
    : Item
  : never;

// 更實用：提取 API 返回類型的精確形狀
type ApiResponse<T extends (...args: any) => any> =
  Awaited<ReturnType<T>> extends { data: infer D } ? D : never;

// 使用示例
async function fetchUser(id: string): Promise<{ data: User; meta: Meta }> {
  return await api.get(id);
}
type UserData = ApiResponse<typeof fetchUser>; // User
```

## 生產中遇到的 TypeScript 嚴格類型問題

### 問題 1：noUncheckedIndexedAccess 與數組操作

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true  // 開啓後：數組訪問返回 T | undefined
  }
}

// ❌ 開啓後，之前沒問題的代碼報錯
function getFirst<T>(arr: T[]): T {
  return arr[0];  // 報錯：Type 'T | undefined' is not assignable to type 'T'
}

// ✅ 修復方案 1：斷言
function getFirst<T>(arr: T[]): T {
  return arr[0]!;  // 非空斷言（需要確認數組非空）
}

// ✅ 修復方案 2：更安全的寫法
function getFirst<T>(arr: [T, ...T[]]): T {  // 至少一個元素的元組
  return arr[0];
}

// ✅ 修復方案 3：明確處理 undefined
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

實踐建議：在大型項目中啓用 `noUncheckedIndexedAccess` 會產生大量需要修復的報錯，建議先在新模塊中試用，而非全量開啓。

### 問題 2：satisfies 運算符的性能開銷

```typescript
// satisfies 在複雜對象上會有顯著的類型檢查性能開銷
// 特別是在大型配置對象中

// ❌ 在大型對象上大量使用 satisfies 會拖慢 tsc
const config = {
  routes: [...],  // 1000+ 路由配置
  plugins: [...], // 100+ 插件
} satisfies AppConfig;

// ✅ 在性能敏感場景，改用類型標註
const config: AppConfig = {
  routes: [...],
  plugins: [...],
};
```

### 問題 3：template literal 類型的遞歸限制

```typescript
// 深層嵌套的 template literal 類型會觸發 TS 的遞歸限制
type DeepPath<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? `${Prefix}${K & string}` | DeepPath<T[K], `${Prefix}${K & string}.`>
        : `${Prefix}${K & string}`;
    }[keyof T]
  : never;

// 對於超過 4-5 層的對象，TypeScript 會報 "Type instantiation is excessively deep"
// 實踐：限制深度或使用運行時方案（zod、yup）替代複雜的類型推導
```

## 有價值的 TS 5.8 新能力

```typescript
// 1. 更智能的 control flow narrowing（自動 narrowing 從未如此精準）
function processValue(val: string | number | null) {
  if (val === null) return;
  // 5.8：val 在複雜分支中的類型推斷更準確
  const result = typeof val === "string" ? val.toUpperCase() : val.toFixed(2);
  // result: string（5.8 正確推斷聯合類型各分支的結果類型）
}

// 2. decorator metadata 改進（配合 Angular/NestJS）
// TS 5.8 更好地支持 Stage 3 裝飾器的 metadata 訪問
```

## 總結

TypeScript 5.8 延續了 5.x 系列"持續打磨邊界情況"的節奏，沒有顛覆性變化。對生產項目最有價值的是 `--erasableSyntaxOnly`（準備 Node.js 原生 TS）和改進的 control flow narrowing。`noUncheckedIndexedAccess` 理論上更安全，但大型項目引入代價較高，建議在新模塊中逐步試用。
