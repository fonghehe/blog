---
title: "TypeScript 5.6：Iterator Helper、正則型別與嚴格的內建檢查"
date: 2024-09-22 10:00:00
tags:
  - TypeScript
readingTime: 2
description: "TypeScript 5.6 正式釋出，帶來了一些實用的語言特性和型別檢查增強。挑幾個對日常開發影響最大的變化。"
---

TypeScript 5.6 正式釋出，帶來了一些實用的語言特性和型別檢查增強。挑幾個對日常開發影響最大的變化。

## Iterator Helpers

對迭代器的原生支援，可以在 `for...of` 和生成器上直接鏈式操作：

```typescript
// 以前：需要轉陣列再處理
const users = Array.from(getAllUsers());
const activeEmails = users
  .filter((u) => u.isActive)
  .map((u) => u.email);

// TypeScript 5.6 + ES2024 Iterator Helpers
const activeEmails = getAllUsers()
  .filter((u) => u.isActive)
  .map((u) => u.email);
// 返回 Iterator，不建立中間陣列
```

支援的方法：`map`、`filter`、`take`、`drop`、`flatMap`、`reduce`、`toArray`、`forEach`、`some`、`every`、`find`。

```typescript
// 實用場景：大檔案逐行處理
function* readLines(content: string) {
  for (const line of content.split("\n")) {
    yield line;
  }
}

const errors = readLines(hugeLog)
  .filter((line) => line.includes("ERROR"))
  .take(10)    // 只取前 10 條
  .toArray();  // 轉成陣列

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

## 正規表示式型別檢查

`RegExp` 型別現在支援通過泛型標註捕獲組：

```typescript
// 以前：exec 的結果是 RegExpExecArray | null，捕獲組型別丟失
const match = /user-(\d+)/.exec("user-42");
// match[1] 是 string，沒有自動型別

// TypeScript 5.6：可以標註捕獲組
function parseRoute(path: string) {
  const match = /^\/users\/(?<id>\d+)\/posts\/(?<postId>\d+)$/.exec(path);
  if (!match?.groups) return null;

  return {
    userId: match.groups.id,      // string
    postId: match.groups.postId,  // string
  };
}
```

## 禁止空白屬性宣告

之前容易寫出無意義的空型別屬性，現在會報錯：

```typescript
// TypeScript 5.6 之前不會報錯
interface Config {
  name: string;
  value: number;
  ; // 空語句，無意義
}

// TypeScript 5.6：編譯報錯
// Error: Empty property declaration
```

## 相對路徑補全增強

在 monorepo 中，IDE 的路徑補全更智慧了：

```typescript
// 在 packages/ui/src/Button.tsx 中引用
// TS 5.6 會正確建議相對路徑
import { formatPrice } from "../../utils/src/price";
```

## 控制流分析改進

```typescript
function process(data: string | null) {
  // TS 5.6 能更好地理解函式呼叫中的型別守衛
  if (data !== null) {
    const trimmed = data.trim();
    // trimmed 自動識別為 string
    console.log(trimmed.toUpperCase());
  }
}
```

## 配置項更新

```json
// tsconfig.json 新增選項
{
  "compilerOptions": {
    "target": "ES2024",        // 支援 Iterator Helpers
    "lib": ["ES2024", "DOM"],
    "noUncheckedSideEffectImports": true,  // 檢查副作用匯入
    "isolatedDeclarations": true          // 加速構建
  }
}
```

`isolatedDeclarations` 對 monorepo 構建速度提升很大，允許單獨處理每個檔案的宣告生成。

## 升級注意事項

1. 如果專案用了 Babel 編譯 TS，確保 Babel 外掛支援新的語法
2. `target: "ES2024"` 需要對應的 runtime 支援，或使用 polyfill
3. Iterator Helpers 的 polyfill 可以用 `core-js` 或 `@ungap/iterator-helpers`

## 小結

- Iterator Helpers：惰性迭代鏈，減少中間陣列分配
- 正則型別增強：更好的捕獲組型別推斷
- `isolatedDeclarations`：monorepo 構建加速
- `noUncheckedSideEffectImports`：更嚴格的副作用匯入檢查
- 建議配合 `target: "ES2024"` 使用
