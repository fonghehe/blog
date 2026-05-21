---
title: "Node.js 14 新特性與 Optional Chaining 支持"
date: 2020-08-17 10:39:36
tags:
  - JavaScript
readingTime: 3
description: "Node.js 14 LTS 在 4 月份發佈，帶來了不少實用特性。最讓前端工程師開心的是 V8 引擎升級到了 8.1，原生支持了 Optional Chaining（`?.`）和 Nullish Coalescing（`??`）—— 終於不用再在 Node 代碼裏手動轉譯這些語法了。"
wordCount: 280
---

Node.js 14 LTS 在 4 月份發佈，帶來了不少實用特性。最讓前端工程師開心的是 V8 引擎升級到了 8.1，原生支持了 Optional Chaining（`?.`）和 Nullish Coalescing（`??`）—— 終於不用再在 Node 代碼裏手動轉譯這些語法了。

## Optional Chaining（可選鏈）

### 基礎用法

```javascript
// 以前的寫法 —— 冗長且容易出錯
const userName = user && user.profile && user.profile.name;
const street = res && res.data && res.data.address && res.data.address.street;

// Node.js 14 —— 可選鏈
const userName = user?.profile?.name;
const street = res?.data?.address?.street;

// 如果中間任何一環是 null 或 undefined，直接返回 undefined
// 不會報 "Cannot read property 'xxx' of undefined"
```

### 方法調用可選鏈

```javascript
// 調用可能不存在的方法
user?.notify?.("hello");

// 以前
if (user && typeof user.notify === "function") {
  user.notify("hello");
}
```

### 數組訪問可選鏈

```javascript
// 安全地訪問數組元素
const firstItem = arr?.[0];
const nested = matrix?.[row]?.[col];

// 以前
const firstItem = arr && arr[0];
```

### 實戰場景

```javascript
// API 響應處理 —— 非常常見的場景
function getFormattedPrice(response) {
  const price = response?.body?.data?.product?.price?.amount;
  const currency = response?.body?.data?.product?.price?.currency;

  if (price == null) return "價格暫無";
  return `${currency === "CNY" ? "¥" : "$"}${price.toFixed(2)}`;
}

// 配置讀取
const dbHost = config?.database?.connection?.host ?? "localhost";
const dbPort = config?.database?.connection?.port ?? 3306;

// 事件處理
function handleClick(event) {
  const target = event?.target?.dataset?.actionId;
  if (target) {
    dispatchAction(target);
  }
}
```

## Nullish Coalescing（空值合併）

`??` 和 `||` 的區別很重要：

```javascript
// || 在左側為 falsy 時返回右側
// 包括 0, '', false, null, undefined
const count = 0;
const result = count || 10; // 10 —— 0 被認為是 falsy

// ?? 只在左側為 null 或 undefined 時返回右側
const count = 0;
const result = count ?? 10; // 0 —— 0 不是 null/undefined，保留原值

const flag = false;
const r1 = flag || "default"; // 'default'
const r2 = flag ?? "default"; // false

const text = "";
const r3 = text || "無內容"; // '無內容'
const r4 = text ?? "無內容"; // ''
```

### 實際應用

```typescript
// 分頁參數 —— page=0 是合法的第一頁
function getPagination(query: Record<string, string>) {
  const page = Number(query.page ?? "0"); // ?? 確保 page=0 不會被覆蓋
  const size = Number(query.size ?? "20");
  const sort = query.sort ?? "createdAt";
  return { page, size, sort };
}

// API 配置 —— timeout 可能是 0（表示無限等待）
const timeout = options.timeout ?? 30000; // 0 表示不超時，undefined 默認 30 秒

// 和可選鏈組合使用
const name =
  user?.profile?.displayName ?? user?.profile?.username ?? "匿名用户";
```

## Array.flat() 和 Array.flatMap()

Node.js 14 的 V8 8.1 也原生支持了這些方法：

```javascript
// Array.flat() —— 數組扁平化
const nested = [1, [2, 3], [4, [5, 6]]];
nested.flat(); // [1, 2, 3, 4, [5, 6]]
nested.flat(2); // [1, 2, 3, 4, 5, 6]
nested.flat(Infinity); // 完全扁平化

// 實用場景：扁平化目錄結構
const files = [
  ["src/index.js", "src/app.js"],
  ["src/utils/a.js", "src/utils/b.js"],
  ["test/app.test.js"],
];
const allFiles = files.flat();
// ['src/index.js', 'src/app.js', 'src/utils/a.js', 'src/utils/b.js', 'test/app.test.js']

// Array.flatMap() —— map + flat
const sentences = ["Hello World", "Foo Bar"];
const words = sentences.flatMap((s) => s.split(" "));
// ['Hello', 'World', 'Foo', 'Bar']

// 實用：返回空數組時過濾掉
const ids = [1, 2, 3, 4, 5];
const results = ids.flatMap((id) => {
  const item = cache.get(id);
  return item ? [item] : []; // 沒找到就返回空數組，相當於過濾
});
```

## globalThis

統一的全局對象訪問方式：

```javascript
// 以前 —— 需要判斷環境
let globalObj;
if (typeof window !== "undefined") {
  globalObj = window; // 瀏覽器
} else if (typeof global !== "undefined") {
  globalObj = global; // Node.js
} else if (typeof self !== "undefined") {
  globalObj = self; // Web Worker
}

// Node.js 14 —— globalThis
globalObj = globalThis; // 任何環境都適用

// 實用：跨環境的全局緩存
const GLOBAL_KEY = Symbol.for("__myAppCache__");
const cache = globalThis[GLOBAL_KEY] ?? (globalThis[GLOBAL_KEY] = new Map());
```

## String.matchAll()

```javascript
// 以前提取所有匹配項很麻煩
const text = '2020-07-20, 2020-08-17, 2020-09-14'
const regex = /(\d{4})-(\d{2})-(\d{2})/g

// 要用 exec 循環
let match
while ((match = regex.exec(text)) !== null) {
  console.log(match[1], match[2], match[3])
}

// Node.js 14 —— matchAll
for (const match of text.matchAll(regex)) {
  console.log(match[1], match[2], match[3])
}

// 轉成數組
const dates = [...text.matchAll(regex)].map(m => ({
  full: m[0],
  year: m[1],
  month: m[2],
  day: m[3]
}))

// 實用：提取日誌中的錯誤信息
function parseLogErrors(log: string) {
  const pattern = /\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]\s+ERROR:\s+(.+)/g
  return [...log.matchAll(pattern)].map(m => ({
    date: m[1],
    time: m[2],
    message: m[3]
  }))
}
```

## Intl.DisplayNames —— 國際化名稱

```javascript
// 獲取語言、地區、貨幣的本地化顯示名稱
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("US")); // 美國
console.log(regionNames.of("JP")); // 日本
console.log(regionNames.of("CN")); // 中國

const languageNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(languageNames.of("en")); // 英語
console.log(languageNames.of("ja")); // 日語
console.log(languageNames.of("zh")); // 中文

const currencyNames = new Intl.DisplayNames(["zh"], { type: "currency" });
console.log(currencyNames.of("CNY")); // 人民幣
console.log(currencyNames.of("USD")); // 美元
```

## 在 tsconfig.json 中配置

如果項目用 TypeScript，需要注意配置以使用這些新特性：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true
  }
}
```

## 小結

- Node.js 14 原生支持 Optional Chaining（`?.`）和 Nullish Coalescing（`??`），不再需要 Babel 轉譯
- `??` 和 `||` 的區別：`??` 只處理 null/undefined，`||` 處理所有 falsy 值
- `Array.flat()` 和 `Array.flatMap()` 原生可用，簡化數組操作
- `globalThis` 提供了統一的全局對象訪問方式
- `String.matchAll()` 讓正則批量匹配變得優雅
- `Intl.DisplayNames` 方便國際化場景
- tsconfig 的 target 可以設置為 ES2020 來利用這些特性
