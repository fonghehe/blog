---
title: "ES2020 正式リリース：プロジェクトでのベストプラクティス"
date: 2020-01-06 11:24:24
tags:
  - フロントエンド
readingTime: 4
description: "2020 年了，ES2020 的特性已经进入 Stage 4，主流浏览器和 Node 14 都支持了。趁着年初，把项目里能用的新特性梳理一遍，顺便统一团队的编码风格。"
wordCount: 727
---

2020 年になり、ES2020 の機能は Stage 4 に入り、主要なブラウザと Node 14 が対応した。年始めに、プロジェクトで使える新機能を洗い出し、ついでにチームのコーディングスタイルを統一しておこう。

## オプショナルチェーン (?.)

防御的プログラミングについてこれまで何本か記事を書いてきたが、ついに言語レベルでのサポートが入った。

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

**実際のプロジェクトでの適用：**

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

**ハマりやすい点：** `?.` を関数呼び出しと組み合わせる際の注意点：

```javascript
// 这样写有问题：如果 obj.method 不存在，后面的 () 还是会执行
obj?.method();      // OK：method 不存在时不调用

// 但这种情况要小心
obj.method?.(arg);  // 如果 method 存在但不是函数，?.(arg) 返回 undefined
                    // 而不会报错，可能掩盖 bug
```

## Null合体演算子 (??)

以前は `||` でデフォルト値を作っていたが、`0`、`''`、`false` もすべて巻き込まれていた。

```javascript
// 老写法的坑
const pageSize = config.pageSize || 20;
// 如果 config.pageSize = 0，期望用 0 但结果是 20

// ES2020
const pageSize = config.pageSize ?? 20;
// 只有 undefined 和 null 才用默认值
// 0、''、false 都保留
```

**チーム規約：`??` と `||` の使い分け：**

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

この機能はチームで長く待ち望んでいた。以前バッチリクエストを作るとき、`Promise.all` は一つでも失敗すると全部失敗してしまい、本当に困った。

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

**実際のケース：レポートの一括エクスポート**

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

以前は Webpack のコード分割で動的 import を使っていた。だが言語標準としては、今の方がより正規のやり方だ。

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

こんな気持ち悪い互換コードを書かずに済むようになった：

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

ユーティリティライブラリでは役立つ：

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

## BigInt（知っていれば十分）

フロントエンドで大きな整数を使う場面は多くないが、バックエンドの ID を扱う際に出会うことがある。

```javascript
// 超过 Number.MAX_SAFE_INTEGER 的 ID
const userId = 9007199254740993n;  // BigInt 字面量

// 从字符串创建
const bigId = BigInt('9007199254740993');

// 注意：BigInt 和 Number 不能直接运算
// const result = userId + 1;  // TypeError
const result = userId + 1n;     // OK
```

現在のところバックエンドの ID は安全範囲内なので当面不要だが、知識として押さえておくべきだ。

## プロジェクトへの導入計画

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

- Optional Chaining と Nullish Coalescing は最も実用的な2つの機能で、防御的なコードを直接減らせる
- `??` を `||` の代わりにデフォルト値に使う際は場面を見分ける：falsy を飛ばしたいなら `||`、nullish だけを飛ばしたいなら `??`
- `Promise.allSettled` はバッチリクエストの部分的な失敗の問題を解決し、`Promise.all` より安全だ
- 動的 import はコード分割の標準的な方法で、ルーティングの遅延読み込みと組み合わせると効果的だ
- `globalThis` はグローバルオブジェクトの取得を統一し、クロスプラットフォームなユーティリティライブラリを書く際に役立つ
