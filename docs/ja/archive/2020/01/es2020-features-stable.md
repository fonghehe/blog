---
title: "ES2020 正式リリース：プロジェクトでのベストプラクティス"
date: 2020-01-06 11:24:24
tags:
  - フロントエンド
readingTime: 3
description: "2020 年了，ES2020 的特性已经进入 Stage 4，主流浏览器和 Node 14 都支持了。趁着年初，把项目里能用的新特性梳理一遍，顺便统一团队的编码风格。"
wordCount: 458
---

2020 年了，ES2020 的特性已经进入 Stage 4，主流浏览器和 Node 14 都支持了。趁着年初，把项目里能用的新特性梳理一遍，顺便统一团队的编码风格。

## オプショナルチェーン (?.)

之前写过好几篇关于防御性编程的文章，现在终于有了语言层面的支持。

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

**在我们项目里的实际应用：**

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

**一个踩坑点：** `?.` 和函数调用结合时要注意：

```javascript
// 这样写有问题：如果 obj.method 不存在，后面的 () 还是会执行
obj?.method();      // OK：method 不存在时不调用

// 但这种情况要小心
obj.method?.(arg);  // 如果 method 存在但不是函数，?.(arg) 返回 undefined
                    // 而不会报错，可能掩盖 bug
```

## Null合体演算子 (??)

以前用 `||` 做默认值，但 `0`、`''`、`false` 都会被吃掉。

```javascript
// 老写法的坑
const pageSize = config.pageSize || 20;
// 如果 config.pageSize = 0，期望用 0 但结果是 20

// ES2020
const pageSize = config.pageSize ?? 20;
// 只有 undefined 和 null 才用默认值
// 0、''、false 都保留
```

**团队规范：什么时候用 `??` 什么时候用 `||`？**

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

这个特性我们团队盼了很久。之前做批量请求，`Promise.all` 一个失败全部失败太坑了。

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

**实际场景：批量导出报表**

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

## 动态 import()

之前用 Webpack 的 code splitting，动态 import 已经在用了。但作为语言标准，现在更规范。

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

终于不用写这种恶心的兼容代码了：

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

在工具库中很有用：

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

## BigInt（了解即可）

前端用到大整数的场景不多，但在处理后端 ID 时可能会遇到。

```javascript
// 超过 Number.MAX_SAFE_INTEGER 的 ID
const userId = 9007199254740993n;  // BigInt 字面量

// 从字符串创建
const bigId = BigInt('9007199254740993');

// 注意：BigInt 和 Number 不能直接运算
// const result = userId + 1;  // TypeError
const result = userId + 1n;     // OK
```

我们目前后端 ID 还在安全范围内，暂时不需要，但作为知识储备要知道。

## 项目落地计划

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

## まとめ

- Optional Chaining 和 Nullish Coalescing 是最实用的两个特性，直接减少防御性代码
- `??` 替代 `||` 做默认值要注意区分场景：需要跳过 falsy 用 `||`，只跳过 nullish 用 `??`
- `Promise.allSettled` 解决了批量请求的部分失败问题，比 `Promise.all` 更安全
- 动态 import 是代码拆分的标准方式，配合路由懒加载效果好
- `globalThis` 统一了全局对象获取，写跨平台工具库时有用
