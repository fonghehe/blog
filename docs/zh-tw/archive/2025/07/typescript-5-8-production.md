---
title: "TypeScript 5.8 生產實踐：型別安全的邊界與代價"
date: 2025-07-23 10:00:00
tags:
  - TypeScript
  - 安全
readingTime: 2
description: "TypeScript 5.8 於 2025 年 2 月釋出（注：這裡指向實際專案中採用的版本）。經過幾個月的生產使用，來分享一些真實場景下 TypeScript 嚴格型別系統的實踐經驗——哪些新特性真正有用，哪些在大型專案中會帶來意外麻煩。"
wordCount: 338
---

TypeScript 5.8 於 2025 年 2 月釋出（注：這裡指向實際專案中採用的版本）。經過幾個月的生產使用，來分享一些真實場景下 TypeScript 嚴格型別系統的實踐經驗——哪些新特性真正有用，哪些在大型專案中會帶來意外麻煩。

## TypeScript 5.8 主要特性回顧

### 1. --erasableSyntaxOnly：為 Node.js 原生 TS 支援最佳化

Node.js 22+ 支援直接執行 `.ts` 檔案（不生成 .js），但只支援"可擦除語法"（不允許 `enum`、`namespace` 等執行時語法）。TS 5.8 新增 `--erasableSyntaxOnly` 選項來檢測違規：

```json
// tsconfig.json（用於 Node.js 原生 TS 專案）
{
  "compilerOptions": {
    "erasableSyntaxOnly": true // 禁止 enum、namespace 等執行時語法
  }
}
```

```typescript
// ❌ 報錯：enum 不是可擦除語法
enum Status {
  Active,
  Inactive,
}

// ✅ 替代方案：const 物件 + 型別
const Status = {
  Active: "active",
  Inactive: "inactive",
} as const;
type Status = (typeof Status)[keyof typeof Status];

// ✅ 替代方案：string literal union
type Status = "active" | "inactive";
```

### 2. 條件型別中的 infer 改進

```typescript
// TS 5.8 之前：提取函式返回型別的 Promise 內層型別需要巢狀 infer
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type UnwrapAll<T> =
  T extends Promise<infer U>
    ? UnwrapAll<U> // 需要手動遞迴
    : T;

// TS 5.8：infer extends 語法更強大
type ExtractArrayItem<T> = T extends (infer Item)[]
  ? Item extends string
    ? `string:${Item}`
    : Item
  : never;

// 更實用：提取 API 返回型別的精確形狀
type ApiResponse<T extends (...args: any) => any> =
  Awaited<ReturnType<T>> extends { data: infer D } ? D : never;

// 使用示例
async function fetchUser(id: string): Promise<{ data: User; meta: Meta }> {
  return await api.get(id);
}
type UserData = ApiResponse<typeof fetchUser>; // User
```

## 生產中遇到的 TypeScript 嚴格型別問題

### 問題 1：noUncheckedIndexedAccess 與陣列操作

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true  // 開啟後：陣列訪問返回 T | undefined
  }
}

// ❌ 開啟後，之前沒問題的程式碼報錯
function getFirst<T>(arr: T[]): T {
  return arr[0];  // 報錯：Type 'T | undefined' is not assignable to type 'T'
}

// ✅ 修復方案 1：斷言
function getFirst<T>(arr: T[]): T {
  return arr[0]!;  // 非空斷言（需要確認陣列非空）
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

實踐建議：在大型專案中啟用 `noUncheckedIndexedAccess` 會產生大量需要修復的報錯，建議先在新模組中試用，而非全量開啟。

### 問題 2：satisfies 運算子的效能開銷

```typescript
// satisfies 在複雜物件上會有顯著的型別檢查效能開銷
// 特別是在大型配置物件中

// ❌ 在大型物件上大量使用 satisfies 會拖慢 tsc
const config = {
  routes: [...],  // 1000+ 路由配置
  plugins: [...], // 100+ 外掛
} satisfies AppConfig;

// ✅ 在效能敏感場景，改用型別標註
const config: AppConfig = {
  routes: [...],
  plugins: [...],
};
```

### 問題 3：template literal 型別的遞迴限制

```typescript
// 深層巢狀的 template literal 型別會觸發 TS 的遞迴限制
type DeepPath<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? `${Prefix}${K & string}` | DeepPath<T[K], `${Prefix}${K & string}.`>
        : `${Prefix}${K & string}`;
    }[keyof T]
  : never;

// 對於超過 4-5 層的物件，TypeScript 會報 "Type instantiation is excessively deep"
// 實踐：限制深度或使用執行時方案（zod、yup）替代複雜的型別推導
```

## 有價值的 TS 5.8 新能力

```typescript
// 1. 更智慧的 control flow narrowing（自動 narrowing 從未如此精準）
function processValue(val: string | number | null) {
  if (val === null) return;
  // 5.8：val 在複雜分支中的型別推斷更準確
  const result = typeof val === "string" ? val.toUpperCase() : val.toFixed(2);
  // result: string（5.8 正確推斷聯合型別各分支的結果型別）
}

// 2. decorator metadata 改進（配合 Angular/NestJS）
// TS 5.8 更好地支援 Stage 3 裝飾器的 metadata 訪問
```

## 總結

TypeScript 5.8 延續了 5.x 系列"持續打磨邊界情況"的節奏，沒有顛覆性變化。對生產專案最有價值的是 `--erasableSyntaxOnly`（準備 Node.js 原生 TS）和改進的 control flow narrowing。`noUncheckedIndexedAccess` 理論上更安全，但大型專案引入代價較高，建議在新模組中逐步試用。
