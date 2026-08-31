---
title: "ES2020 Goes Live: Best Practices for Projects"
date: 2020-01-06 11:24:24
tags:
  - Frontend
readingTime: 3
description: "It's 2020, and ES2020 features have reached Stage 4 with support across major browsers and Node 14. Early in the year is a good time to review the new features we can adopt and unify the team's coding style."
wordCount: 311
---

It's 2020, and ES2020 features have reached Stage 4, with support in major browsers and Node 14. Early in the year is a good time to review the new features we can use in our projects and unify the team's coding style.

## Optional Chaining (?.)

I've written several articles on defensive programming before, and now we finally have language-level support for it.

```javascript
// 老写法：层层判断
const userName = response && response.data && response.data.user && response.data.user.name;

// ES2020：Optional Chaining
const userName = response?.data?.user?.name;

// 方法调用也可以
const result = api?.getUserInfo?.();

// 数组访问
const firstItem = arr?.[0];
```

**How we apply it in our project:**

```javascript
// API 响应处理 —— 以前最容易出 TypeError 的地方
function formatOrder(order) {
  return {
    id: order?.id ?? 'unknown',
    // 注意：Optional Chaining + Nullish Coalescing 配合使用
    address: order?.shipping?.address?.full ?? '地址未填写',
    phone: order?.contact?.phone ?? '',
    // 嵌套对象的安全访问
    discount: order?.promotion?.discount?.rate ?? 0,
  };
}
```

**One gotcha:** watch out when combining `?.` with function calls:

```javascript
// 这样写有问题：如果 obj.method 不存在，后面的 () 还是会执行
obj?.method();      // OK：method 不存在时不调用

// 但这种情况要小心
obj.method?.(arg);  // 如果 method 存在但不是函数，?.(arg) 返回 undefined
                    // 而不会报错，可能掩盖 bug
```

## Nullish Coalescing (??)

Previously, `||` was used for defaults, but `0`, `''`, and `false` would all be swallowed.

```javascript
// 老写法的坑
const pageSize = config.pageSize || 20;
// 如果 config.pageSize = 0，期望用 0 但结果是 20

// ES2020
const pageSize = config.pageSize ?? 20;
// 只有 undefined 和 null 才用默认值
// 0、''、false 都保留
```

**Team convention: when to use `??` vs. `||`:**

```javascript
// 明确规则：
// 1. 真正需要"兜底"的场景用 ||
const displayName = user.nickname || user.username || '匿名用户';

// 2. 可能是合法 falsy 值（0, '', false）的场景用 ??
const timeout = config.timeout ?? 3000;        // 0 是合法值
const title = config.title ?? '默认标题';       // '' 是合法值
const isDebug = config.isDebug ?? false;        // false 是合法值

// 3. ?? 和 || 不能混用（没有短路优先级）
// const x = a ?? b || c;  // SyntaxError，必须加括号
const x = (a ?? b) || c;  // OK
```

## Promise.allSettled

Our team has been waiting for this feature for a long time. When we did batch requests before, a single failure in `Promise.all` would fail everything—a real pain.

```javascript
// 老写法：要自己包一层
function safeAll(promises) {
  return Promise.all(
    promises.map(p =>
      p
        .then(value => ({ status: 'fulfilled', value }))
        .catch(reason => ({ status: 'rejected', reason }))
    )
  );
}

// ES2020 内置了
const results = await Promise.allSettled([
  fetch('/api/user'),
  fetch('/api/orders'),
  fetch('/api/messages'),
]);

results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log('成功:', result.value);
  } else {
    console.log('失败:', result.reason);
  }
});
```

**Real-world scenario: batch report export**

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

  // 部分成功也正常返回，失败的单独记录
  return { successes, failures };
}
```

## Dynamic import()

We were already using dynamic `import()` for Webpack code splitting. But now that it's a language standard, it's more standardized.

```javascript
// 路由懒加载（Vue 项目）
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

// 条件加载模块
async function handleExport(type) {
  if (type === 'excel') {
    const { exportToExcel } = await import('./utils/excel-exporter');
    return exportToExcel;
  } else if (type === 'pdf') {
    const { exportToPdf } = await import('./utils/pdf-exporter');
    return exportToPdf;
  }
}

// 错误处理
async function loadChartModule() {
  try {
    const module = await import('./charts/advanced-chart');
    return module.default;
  } catch (err) {
    console.error('图表模块加载失败，使用基础版本', err);
    const fallback = await import('./charts/basic-chart');
    return fallback.default;
  }
}
```

## globalThis

We can finally stop writing this nasty compatibility code:

```javascript
// 老写法：判断环境
const globalObj =
  typeof window !== 'undefined' ? window :
  typeof global !== 'undefined' ? global :
  typeof self !== 'undefined' ? self :
  {};

// ES2020
const globalObj = globalThis;
```

It's useful in utility libraries:

```javascript
// polyfill 注册
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

// 全局配置存储
globalThis.__APP_CONFIG__ = {
  apiBase: 'https://api.example.com',
  version: '2.1.0',
};
```

## BigInt (For Reference)

Frontend code rarely deals with very large integers, but you might encounter them when handling backend IDs.

```javascript
// 超过 Number.MAX_SAFE_INTEGER 的 ID
const userId = 9007199254740993n;  // BigInt 字面量

// 从字符串创建
const bigId = BigInt('9007199254740993');

// 注意：BigInt 和 Number 不能直接运算
// const result = userId + 1;  // TypeError
const result = userId + 1n;     // OK
```

For now our backend IDs are still within the safe range, so we don't need it yet—but it's worth knowing about as background knowledge.

## Rollout Plan

```
1. Babel 配置升级
   - @babel/preset-env 的 targets 设为 "defaults"
   - 确保 core-js 3.x 已安装

2. ESLint 规则更新
   - 开启 optional-chaining 和 nullish-coalescing 的 lint 规则
   - 禁止使用 || 对可能为 0 的数值做默认值

3. 团队推广
   - 周会分享 15 分钟，把本文的要点过一遍
   - Code Review 时重点检查新写法的使用是否正确
```

## Summary

- Optional chaining and nullish coalescing are the two most practical features, directly cutting down on defensive code.
- When replacing `||` with `??` for defaults, distinguish the scenarios: use `||` when you want to skip falsy values, and `??` when you only want to skip nullish ones.
- `Promise.allSettled` solves the partial-failure problem in batch requests, making it safer than `Promise.all`.
- Dynamic `import()` is the standard way to split code, and it works great with route-based lazy loading.
- `globalThis` unifies access to the global object and is handy when writing cross-platform utility libraries.
