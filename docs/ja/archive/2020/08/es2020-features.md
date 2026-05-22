---
title: "ES2020 実用的な新機能詳解"
date: 2020-08-04 17:33:04
tags:
  - フロントエンド
readingTime: 2
description: "ES2020（ES11）仕様が正式にリリースされ、いくつかの非常に便利な機能がもたらされました。日常のコードで使用することで、定型コードを大幅に削減できます。"
wordCount: 277
---

ES2020（ES11）仕様が正式にリリースされ、いくつかの非常に実用的な機能がもたらされました。日常のコードで使用することで、定型コードを大幅に削減できます。

## オプショナルチェーン (?.)

```javascript
// 深くネストされたプロパティにアクセスする際、段階的な判定が不要に
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

// メソッド呼び出し
const result = api?.getData?.();

// 配列要素
const first = arr?.[0];

// 注意：null と undefined のみをスキップする
// 0、''、false はスキップされない
const obj = { count: 0 };
console.log(obj?.count); // 0（正常にアクセス）
```

## Null合体演算子 (??)

```javascript
// || との違い：null/undefined の場合のみ右辺を返す
const value = 0;

// || は 0 を falsy として扱う
console.log(value || 10);  // 10（誤り）

// ?? は null/undefined のみを判定
console.log(value ?? 10);  // 0（正しい）

// 典型的なユースケース
function createConfig(input) {
  return {
    timeout: input.timeout ?? 3000,
    retries: input.retries ?? 3,
    debug: input.debug ?? false,  // false は || で上書きされない
  };
}

// チェーンで使用可能
const result = a?.b?.c ?? 'デフォルト値';
```

## BigInt

```javascript
// Number.MAX_SAFE_INTEGER を超える整数を扱う
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// この数を超えると精度が失われる
console.log(9007199254740992 + 1); // 9007199254740992（誤り！）

// BigInt を使用
const big = 9007199254740992n;
console.log(big + 1n); // 9007199254740993n

// 実際のユースケース：データベース ID
const userId = 12345678901234567890n;

// 変換
BigInt('12345678901234567890'); // 文字列から
Number(123n);                    // Number に戻す（精度に注意）

// 演算
const a = 100n;
const b = 200n;
console.log(a + b);  // 300n
console.log(a * b);  // 20000n

// 注意：BigInt と Number は混在して計算できない
// console.log(1n + 1); // TypeError

// 比較は可能
console.log(1n < 2);   // true
console.log(1n === 1); // false（型が異なる）
console.log(1n == 1);  // true
```

## Promise.allSettled

```javascript
// Promise.all：1つでも失敗するとすべて失敗
// Promise.allSettled：成功・失敗に関わらず全ての完了を待つ

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

// 実際のユースケース：バッチリクエスト、一部の失敗が他に影響しない
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
// 以前：環境ごとに異なる方法でグローバルオブジェクトを取得
// ブラウザ：window / self
// Node.js：global
// Web Worker：self
// 共通の書き方は見苦しい

// ES2020：globalThis で統一
console.log(globalThis); // ブラウザでは window、Node.js では global

// 実際のユースケース：共通ユーティリティ関数
function setGlobalCache(key, value) {
  globalThis.__cache = globalThis.__cache || {};
  globalThis.__cache[key] = value;
}

// どの環境でも動作する
```

## String.matchAll

```javascript
const text = '2020-01-15, 2020-02-20, 2020-03-25';
const regex = /(\d{4})-(\d{2})-(\d{2})/g;

// 以前：exec でループ
let match;
while ((match = regex.exec(text)) !== null) {
  console.log(match[0], match[1], match[2], match[3]);
}

// 現在：matchAll はイテレータを返す
for (const match of text.matchAll(regex)) {
  console.log(match[0], match[1], match[2], match[3]);
}
// 2020-01-15 2020 01 15
// 2020-02-20 2020 02 20
// 2020-03-25 2020 03 25

// 実際のユースケース：URL パラメータの抽出
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

## 動的 import()

```javascript
// 必要に応じてモジュールをロード
button.addEventListener('click', async () => {
  const { formatDate } = await import('./utils/date.js');
  console.log(formatDate(new Date()));
});

// Vue ルートの遅延ロード
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
];

// 条件付きインポート
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

## まとめ

- オプショナルチェーンとNull合体演算子は最も実用的な機能で、日常のコードで毎日使用します
- BigInt は大きな整数を扱うため、データベース ID や金融計算などのシナリオに適しています
- Promise.allSettled はバッチリクエストにおける一部の失敗に対処します
- globalThis はグローバルオブジェクトへのアクセス方法を統一しました
- これらの機能はモダンブラウザですでにサポートされており、古いプロジェクトでは Babel でトランスパイル可能です
