---
title: "TypeScript 5.4：NoIntrinsic、Object.groupBy 與型別推斷增強"
date: 2024-02-06 10:05:36
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.4 正式釋出，帶來了一些實用的型別系統改進和對 TC39 新提案的支援。從架構視角看，有幾個特性對團隊程式碼質量提升明顯。"
---

TypeScript 5.4 正式釋出，帶來了一些實用的型別系統改進和對 TC39 新提案的支援。從架構視角看，有幾個特性對團隊程式碼質量提升明顯。

## Object.groupBy 和 Map.groupBy

之前分組操作需要寫 reduce：

```typescript
// 以前：手寫 reduce
const grouped = users.reduce((acc, user) => {
  const key = user.role;
  if (!acc[key]) acc[key] = [];
  acc[key].push(user);
  return acc;
}, {} as Record<string, User[]>);

// TypeScript 5.4 + ES2024
const grouped = Object.groupBy(users, (user) => user.role);
// grouped 的型別是 Partial<Record<string, User[]>>
```

返回 `Partial` 是合理的，因為分組結果可能不包含所有可能的 key。

`Map.groupBy` 則返回 `Map<K, V[]>`，支援任意型別作為 key：

```typescript
const byDept = Map.groupBy(users, (u) => departments.get(u.deptId)!);
// 返回 Map<Department, User[]>
```

## NoIntrinsic 型別安全增強

TypeScript 5.4 引入了 `NoIntrinsic` 型別，這是對模板字面量型別的增強。在處理 HTML 屬性對映時更精確：

```typescript
// 型別推斷更精準，條件型別中交叉型別分發更正確
type ExtractId<T> = T extends `${infer Prefix}_${infer Suffix}`
  ? `${Prefix}_id`
  : never;

type Result = ExtractId<"user_name" | "post_title">;
// "user_id" | "post_id"
```

## 改進的閉包型別縮小

一個很實用的改進：閉包中捕獲的變數現在能正確保持型別縮小：

```typescript
function processValue(input: string | number) {
  if (typeof input === "string") {
    // TS 5.4 之前：閉包中 input 可能丟失 string 型別
    const handler = () => {
      return input.toUpperCase(); // 現在能正確識別為 string
    };
  }
}
```

## in 運算子的型別收窄增強

```typescript
interface Dog {
  bark(): void;
}

interface Cat {
  meow(): void;
}

function handlePet(pet: Dog | Cat) {
  if ("bark" in pet) {
    pet.bark(); // TS 5.4 之前這裡可能不夠精確
  }
}
```

## 在專案中的落地

我們團隊在升級 TS 5.4 時，重點關注了幾個場景：

1. **資料處理層**：把自定義 groupBy 工具函式替換為原生 `Object.groupBy`，減少約 200 行重複程式碼
2. **型別安全**：利用改進的條件型別推斷，簡化了 API 響應型別的自動推導
3. **團隊規範**：更新 ESLint 規則，檢測並標記可以使用原生 API 的地方

## 小結

- `Object.groupBy` / `Map.groupBy`：原生分組 API，減少重複工具函式
- 閉包型別縮小：閉包中捕獲的變數保持型別資訊
- `in` 運算子增強：更精確的型別收窄
- 條件型別推斷改進：交叉型別處理更準確
- 建議團隊統一升級，配合 `target: "ES2024"` 使用