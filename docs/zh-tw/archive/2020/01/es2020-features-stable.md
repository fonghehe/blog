---
title: "ES2020 正式落地：專案中的最佳實踐"
date: 2020-01-06 11:24:24
tags:
  - 前端
readingTime: 3
description: "2020 年了，ES2020 的特性已經進入 Stage 4，主流瀏覽器和 Node 14 都支援了。趁著年初，把專案裡能用的新特性梳理一遍，順便統一團隊的編碼風格。"
---

2020 年了，ES2020 的特性已經進入 Stage 4，主流瀏覽器和 Node 14 都支援了。趁著年初，把專案裡能用的新特性梳理一遍，順便統一團隊的編碼風格。

## Optional Chaining (?.)

之前寫過好幾篇關於防禦性程式設計的文章，現在終於有了語言層面的支援。

```javascript
// 老寫法：層層判斷
const userName = response && response.data && response.data.user && response.data.user.name;

// ES2020：Optional Chaining
const userName = response?.data?.user?.name;

// 方法呼叫也可以
const result = api?.getUserInfo?.();

// 陣列訪問
const firstItem = arr?.[0];
```

**在我們專案裡的實際應用：**

```javascript
// API 響應處理 —— 以前最容易出 TypeError 的地方
function formatOrder(order) {
  return {
    id: order?.id ?? 'unknown',
    // 注意：Optional Chaining + Nullish Coalescing 配合使用
    address: order?.shipping?.address?.full ?? '地址未填寫',
    phone: order?.contact?.phone ?? '',
    // 巢狀物件的安全訪問
    discount: order?.promotion?.discount?.rate ?? 0,
  };
}
```

**一個踩坑點：** `?.` 和函式呼叫結合時要注意：

```javascript
// 這樣寫有問題：如果 obj.method 不存在，後面的 () 還是會執行
obj?.method();      // OK：method 不存在時不呼叫

// 但這種情況要小心
obj.method?.(arg);  // 如果 method 存在但不是函式，?.(arg) 返回 undefined
                    // 而不會報錯，可能掩蓋 bug
```

## Nullish Coalescing (??)

以前用 `||` 做預設值，但 `0`、`''`、`false` 都會被吃掉。

```javascript
// 老寫法的坑
const pageSize = config.pageSize || 20;
// 如果 config.pageSize = 0，期望用 0 但結果是 20

// ES2020
const pageSize = config.pageSize ?? 20;
// 只有 undefined 和 null 才用預設值
// 0、''、false 都保留
```

**團隊規範：什麼時候用 `??` 什麼時候用 `||`？**

```javascript
// 明確規則：
// 1. 真正需要"兜底"的場景用 ||
const displayName = user.nickname || user.username || '匿名使用者';

// 2. 可能是合法 falsy 值（0, '', false）的場景用 ??
const timeout = config.timeout ?? 3000;        // 0 是合法值
const title = config.title ?? '預設標題';       // '' 是合法值
const isDebug = config.isDebug ?? false;        // false 是合法值

// 3. ?? 和 || 不能混用（沒有短路優先順序）
// const x = a ?? b || c;  // SyntaxError，必須加括號
const x = (a ?? b) || c;  // OK
```

## Promise.allSettled

這個特性我們團隊盼了很久。之前做批次請求，`Promise.all` 一個失敗全部失敗太坑了。

```javascript
// 老寫法：要自己包一層
function safeAll(promises) {
  return Promise.all(
    promises.map(p =>
      p
        .then(value => ({ status: 'fulfilled', value }))
        .catch(reason => ({ status: 'rejected', reason }))
    )
  );
}

// ES2020 內建了
const results = await Promise.allSettled([
  fetch('/api/user'),
  fetch('/api/orders'),
  fetch('/api/messages'),
]);

results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log('成功:', result.value);
  } else {
    console.log('失敗:', result.reason);
  }
});
```

**實際場景：批次匯出報表**

```javascript
async function exportReports(reportIds) {
  const tasks = reportIds.map(id =>
    fetch(`/api/reports/${id}`).then(r => r.json())
  );

  const results = await Promise.allSettled(tasks);

  const { successes, failures } = results.reduce(
    (acc, result, index) => {
      if (result.status === 'fulfilled') {
        acc.successes.push({ id: reportIds[index], data: result.value });
      } else {
        acc.failures.push({ id: reportIds[index], error: result.reason });
      }
      return acc;
    },
    { successes: [], failures: [] }
  );

  // 部分成功也正常返回，失敗的單獨記錄
  return { successes, failures };
}
```

## 動態 import()

之前用 Webpack 的 code splitting，動態 import 已經在用了。但作為語言標準，現在更規範。

```javascript
// 路由懶載入（Vue 專案）
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
  {
    path: '/settings',
    component: () => import('./views/Settings.vue'),
  },
];

// 條件載入模組
async function handleExport(type) {
  if (type === 'excel') {
    const { exportToExcel } = await import('./utils/excel-exporter');
    return exportToExcel;
  } else if (type === 'pdf') {
    const { exportToPdf } = await import('./utils/pdf-exporter');
    return exportToPdf;
  }
}

// 錯誤處理
async function loadChartModule() {
  try {
    const module = await import('./charts/advanced-chart');
    return module.default;
  } catch (err) {
    console.error('圖表模組載入失敗，使用基礎版本', err);
    const fallback = await import('./charts/basic-chart');
    return fallback.default;
  }
}
```

## globalThis

終於不用寫這種噁心的相容程式碼了：

```javascript
// 老寫法：判斷環境
const globalObj =
  typeof window !== 'undefined' ? window :
  typeof global !== 'undefined' ? global :
  typeof self !== 'undefined' ? self :
  {};

// ES2020
const globalObj = globalThis;
```

在工具庫中很有用：

```javascript
// polyfill 註冊
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

// 全域性配置儲存
globalThis.__APP_CONFIG__ = {
  apiBase: 'https://api.example.com',
  version: '2.1.0',
};
```

## BigInt（瞭解即可）

前端用到大整數的場景不多，但在處理後端 ID 時可能會遇到。

```javascript
// 超過 Number.MAX_SAFE_INTEGER 的 ID
const userId = 9007199254740993n;  // BigInt 字面量

// 從字串建立
const bigId = BigInt('9007199254740993');

// 注意：BigInt 和 Number 不能直接運算
// const result = userId + 1;  // TypeError
const result = userId + 1n;     // OK
```

我們目前後端 ID 還在安全範圍內，暫時不需要，但作為知識儲備要知道。

## 專案落地計劃

```
1. Babel 配置升級
   - @babel/preset-env 的 targets 設為 "defaults"
   - 確保 core-js 3.x 已安裝

2. ESLint 規則更新
   - 開啟 optional-chaining 和 nullish-coalescing 的 lint 規則
   - 禁止使用 || 對可能為 0 的數值做預設值

3. 團隊推廣
   - 週會分享 15 分鐘，把本文的要點過一遍
   - Code Review 時重點檢查新寫法的使用是否正確
```

## 小結

- Optional Chaining 和 Nullish Coalescing 是最實用的兩個特性，直接減少防禦性程式碼
- `??` 替代 `||` 做預設值要注意區分場景：需要跳過 falsy 用 `||`，只跳過 nullish 用 `??`
- `Promise.allSettled` 解決了批次請求的部分失敗問題，比 `Promise.all` 更安全
- 動態 import 是程式碼拆分的標準方式，配合路由懶載入效果好
- `globalThis` 統一了全域性物件獲取，寫跨平臺工具庫時有用
