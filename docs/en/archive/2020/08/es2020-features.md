---
title: "ES2020 Practical New Features Explained"
date: 2020-08-04 17:33:04
tags:
  - Frontend
readingTime: 2
description: "ES2020（ES11）规范已经正式发布，带来了几个非常实用的特性。在日常代码中用起来，能明显减少模板代码。"
wordCount: 150
---

ES2020（ES11）规范已经正式发布，带来了几个非常实用的特性。在日常代码中用起来，能明显减少模板代码。

## Optional Chaining (?. )

```javascript
// 访问深层嵌套属性，不再需要层层判断
const user = {
  profile: {
    address: {
      city: '北京',
    },
  },
};

// 以前
const city = user && user.profile && user.profile.address && user.profile.address.city;

// 现在
const city = user?.profile?.address?.city;

// 方法调用
const result = api?.getData?.();

// 数组元素
const first = arr?.[0];

// 注意：只跳过 null 和 undefined
// 0、''、false 不会被跳过
const obj = { count: 0 };
console.log(obj?.count); // 0（正常访问）
```

## Nullish Coalescing (??)

```javascript
// 和 || 的区别：只对 null/undefined 生效
const value = 0;

// || 会把 0 当假值
console.log(value || 10);  // 10（不对）

// ?? 只看 null/undefined
console.log(value ?? 10);  // 0（正确）

// 典型场景
function createConfig(input) {
  return {
    timeout: input.timeout ?? 3000,
    retries: input.retries ?? 3,
    debug: input.debug ?? false,  // false 不会被 || 覆盖
  };
}

// 可以链式使用
const result = a?.b?.c ?? '默认值';
```

## BigInt

```javascript
// 处理超过 Number.MAX_SAFE_INTEGER 的整数
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// 超过这个数就会丢失精度
console.log(9007199254740992 + 1); // 9007199254740992（错！）

// 用 BigInt
const big = 9007199254740992n;
console.log(big + 1n); // 9007199254740993n

// 实际场景：数据库 ID
const userId = 12345678901234567890n;

// 转换
BigInt('12345678901234567890'); // 从字符串
Number(123n);                    // 转回 Number（注意精度）

// 运算
const a = 100n;
const b = 200n;
console.log(a + b);  // 300n
console.log(a * b);  // 20000n

// 注意：BigInt 和 Number 不能混算
// console.log(1n + 1); // TypeError

// 比较可以
console.log(1n < 2);   // true
console.log(1n === 1); // false（类型不同）
console.log(1n == 1);  // true
```

## Promise.allSettled

```javascript
// Promise.all：一个失败就全部失败
// Promise.allSettled：等所有都完成，不管成功还是失败

const apis = [
  fetch('/api/users'),
  fetch('/api/orders'),
  fetch('/api/products'),
];

const results = await Promise.allSettled(apis);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`API ${index} 成功:`, result.value);
  } else {
    console.log(`API ${index} 失败:`, result.reason);
  }
});

// 实际场景：批量请求，部分失败不影响其他
async function fetchDashboardData() {
  const results = await Promise.allSettled([
    fetchUserInfo(),
    fetchOrders(),
    fetchNotifications(),
    fetchStatistics(),
  ]);

  return {
    user: results[0].status === 'fulfilled' ? results[0].value : null,
    orders: results[1].status === 'fulfilled' ? results[1].value : [],
    notifications: results[2].status === 'fulfilled' ? results[2].value : [],
    statistics: results[3].status === 'fulfilled' ? results[3].value : {},
    errors: results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason?.message),
  };
}
```

## globalThis

```javascript
// 以前：获取全局对象，在不同环境写法不同
// 浏览器：window / self
// Node.js：global
// Web Worker：self
// 通用写法很丑

// ES2020：globalThis 统一了
console.log(globalThis); // 浏览器中是 window，Node.js 中是 global

// 实际场景：通用工具函数
function setGlobalCache(key, value) {
  globalThis.__cache = globalThis.__cache || {};
  globalThis.__cache[key] = value;
}

// 在任何环境都能工作
```

## String.matchAll

```javascript
const text = '2020-01-15, 2020-02-20, 2020-03-25';
const regex = /(\d{4})-(\d{2})-(\d{2})/g;

// 以前：循环 exec
let match;
while ((match = regex.exec(text)) !== null) {
  console.log(match[0], match[1], match[2], match[3]);
}

// 现在：matchAll 返回迭代器
for (const match of text.matchAll(regex)) {
  console.log(match[0], match[1], match[2], match[3]);
}
// 2020-01-15 2020 01 15
// 2020-02-20 2020 02 20
// 2020-03-25 2020 03 25

// 实际场景：提取 URL 参数
function extractParams(url) {
  const params = {};
  for (const [, key, value] of url.matchAll(/[?&](\w+)=(\w+)/g)) {
    params[key] = value;
  }
  return params;
}

extractParams('https://example.com?id=1&type=admin');
// { id: '1', type: 'admin' }
```

## Dynamic import()

```javascript
// 按需加载模块
button.addEventListener('click', async () => {
  const { formatDate } = await import('./utils/date.js');
  console.log(formatDate(new Date()));
});

// Vue 路由懒加载
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
];

// 条件导入
async function loadChart(type) {
  if (type === 'bar') {
    const { BarChart } = await import('./charts/BarChart.js');
    return new BarChart();
  } else if (type === 'line') {
    const { LineChart } = await import('./charts/LineChart.js');
    return new LineChart();
  }
}
```

## Summary

- 可选链和空值合并是最实用的特性，日常代码每天都会用到
- BigInt 处理大整数，适合数据库 ID、金融计算等场景
- Promise.allSettled 解决批量请求中部分失败的需求
- globalThis 统一了全局对象的访问方式
- 这些特性在现代浏览器中都已支持，老项目可用 Babel 降级
