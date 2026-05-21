---
title: "ES2020 實用新特性詳解"
date: 2020-08-04 17:33:04
tags:
  - 前端
readingTime: 2
description: "ES2020（ES11）規範已經正式發佈，帶來了幾個非常實用的特性。在日常代碼中用起來，能明顯減少模板代碼。"
wordCount: 155
---

ES2020（ES11）規範已經正式發佈，帶來了幾個非常實用的特性。在日常代碼中用起來，能明顯減少模板代碼。

## 可選鏈 ?.

```javascript
// 訪問深層嵌套屬性，不再需要層層判斷
const user = {
  profile: {
    address: {
      city: '北京',
    },
  },
};

// 以前
const city = user && user.profile && user.profile.address && user.profile.address.city;

// 現在
const city = user?.profile?.address?.city;

// 方法調用
const result = api?.getData?.();

// 數組元素
const first = arr?.[0];

// 注意：只跳過 null 和 undefined
// 0、''、false 不會被跳過
const obj = { count: 0 };
console.log(obj?.count); // 0（正常訪問）
```

## 空值合併 ??

```javascript
// 和 || 的區別：只對 null/undefined 生效
const value = 0;

// || 會把 0 當假值
console.log(value || 10);  // 10（不對）

// ?? 只看 null/undefined
console.log(value ?? 10);  // 0（正確）

// 典型場景
function createConfig(input) {
  return {
    timeout: input.timeout ?? 3000,
    retries: input.retries ?? 3,
    debug: input.debug ?? false,  // false 不會被 || 覆蓋
  };
}

// 可以鏈式使用
const result = a?.b?.c ?? '默認值';
```

## BigInt

```javascript
// 處理超過 Number.MAX_SAFE_INTEGER 的整數
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// 超過這個數就會丟失精度
console.log(9007199254740992 + 1); // 9007199254740992（錯！）

// 用 BigInt
const big = 9007199254740992n;
console.log(big + 1n); // 9007199254740993n

// 實際場景：數據庫 ID
const userId = 12345678901234567890n;

// 轉換
BigInt('12345678901234567890'); // 從字符串
Number(123n);                    // 轉回 Number（注意精度）

// 運算
const a = 100n;
const b = 200n;
console.log(a + b);  // 300n
console.log(a * b);  // 20000n

// 注意：BigInt 和 Number 不能混算
// console.log(1n + 1); // TypeError

// 比較可以
console.log(1n < 2);   // true
console.log(1n === 1); // false（類型不同）
console.log(1n == 1);  // true
```

## Promise.allSettled

```javascript
// Promise.all：一個失敗就全部失敗
// Promise.allSettled：等所有都完成，不管成功還是失敗

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
    console.log(`API ${index} 失敗:`, result.reason);
  }
});

// 實際場景：批量請求，部分失敗不影響其他
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
// 以前：獲取全局對象，在不同環境寫法不同
// 瀏覽器：window / self
// Node.js：global
// Web Worker：self
// 通用寫法很醜

// ES2020：globalThis 統一了
console.log(globalThis); // 瀏覽器中是 window，Node.js 中是 global

// 實際場景：通用工具函數
function setGlobalCache(key, value) {
  globalThis.__cache = globalThis.__cache || {};
  globalThis.__cache[key] = value;
}

// 在任何環境都能工作
```

## String.matchAll

```javascript
const text = '2020-01-15, 2020-02-20, 2020-03-25';
const regex = /(\d{4})-(\d{2})-(\d{2})/g;

// 以前：循環 exec
let match;
while ((match = regex.exec(text)) !== null) {
  console.log(match[0], match[1], match[2], match[3]);
}

// 現在：matchAll 返回迭代器
for (const match of text.matchAll(regex)) {
  console.log(match[0], match[1], match[2], match[3]);
}
// 2020-01-15 2020 01 15
// 2020-02-20 2020 02 20
// 2020-03-25 2020 03 25

// 實際場景：提取 URL 參數
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

## 動態 import()

```javascript
// 按需加載模塊
button.addEventListener('click', async () => {
  const { formatDate } = await import('./utils/date.js');
  console.log(formatDate(new Date()));
});

// Vue 路由懶加載
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
];

// 條件導入
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

## 小結

- 可選鏈和空值合併是最實用的特性，日常代碼每天都會用到
- BigInt 處理大整數，適合數據庫 ID、金融計算等場景
- Promise.allSettled 解決批量請求中部分失敗的需求
- globalThis 統一了全局對象的訪問方式
- 這些特性在現代瀏覽器中都已支持，老項目可用 Babel 降級
