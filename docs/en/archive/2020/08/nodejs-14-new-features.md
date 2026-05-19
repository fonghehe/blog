---
title: "Node.js 14 New Features and Optional Chaining Support"
date: 2020-08-17 10:39:36
tags:
  - JavaScript
readingTime: 3
description: "Node.js 14 LTS 在 4 月份发布，带来了不少实用特性。最让前端工程师开心的是 V8 引擎升级到了 8.1，原生支持了 Optional Chaining（`?.`）和 Nullish Coalescing（`??`）—— 终于不用再在 Node 代码里手动转译这些语法了。"
---

Node.js 14 LTS 在 4 月份发布，带来了不少实用特性。最让前端工程师开心的是 V8 引擎升级到了 8.1，原生支持了 Optional Chaining（`?.`）和 Nullish Coalescing（`??`）—— 终于不用再在 Node 代码里手动转译这些语法了。

## Optional Chaining

### Basic Usage

```javascript
// 以前的写法 —— 冗长且容易出错
const userName = user && user.profile && user.profile.name;
const street = res && res.data && res.data.address && res.data.address.street;

// Node.js 14 —— 可选链
const userName = user?.profile?.name;
const street = res?.data?.address?.street;

// 如果中间任何一环是 null 或 undefined，直接返回 undefined
// 不会报 "Cannot read property 'xxx' of undefined"
```

### Optional Chaining for Method Calls

```javascript
// 调用可能不存在的方法
user?.notify?.("hello");

// 以前
if (user && typeof user.notify === "function") {
  user.notify("hello");
}
```

### Optional Chaining for Array Access

```javascript
// 安全地访问数组元素
const firstItem = arr?.[0];
const nested = matrix?.[row]?.[col];

// 以前
const firstItem = arr && arr[0];
```

### Practical Scenarios

```javascript
// API 响应处理 —— 非常常见的场景
function getFormattedPrice(response) {
  const price = response?.body?.data?.product?.price?.amount;
  const currency = response?.body?.data?.product?.price?.currency;

  if (price == null) return "价格暂无";
  return `${currency === "CNY" ? "¥" : "$"}${price.toFixed(2)}`;
}

// 配置读取
const dbHost = config?.database?.connection?.host ?? "localhost";
const dbPort = config?.database?.connection?.port ?? 3306;

// 事件处理
function handleClick(event) {
  const target = event?.target?.dataset?.actionId;
  if (target) {
    dispatchAction(target);
  }
}
```

## Nullish Coalescing

`??` 和 `||` 的区别很重要：

```javascript
// || 在左侧为 falsy 时返回右侧
// 包括 0, '', false, null, undefined
const count = 0;
const result = count || 10; // 10 —— 0 被认为是 falsy

// ?? 只在左侧为 null 或 undefined 时返回右侧
const count = 0;
const result = count ?? 10; // 0 —— 0 不是 null/undefined，保留原值

const flag = false;
const r1 = flag || "default"; // 'default'
const r2 = flag ?? "default"; // false

const text = "";
const r3 = text || "无内容"; // '无内容'
const r4 = text ?? "无内容"; // ''
```

### Practical Applications

```typescript
// 分页参数 —— page=0 是合法的第一页
function getPagination(query: Record<string, string>) {
  const page = Number(query.page ?? "0"); // ?? 确保 page=0 不会被覆盖
  const size = Number(query.size ?? "20");
  const sort = query.sort ?? "createdAt";
  return { page, size, sort };
}

// API 配置 —— timeout 可能是 0（表示无限等待）
const timeout = options.timeout ?? 30000; // 0 表示不超时，undefined 默认 30 秒

// 和可选链组合使用
const name =
  user?.profile?.displayName ?? user?.profile?.username ?? "匿名用户";
```

## Array.flat() and Array.flatMap()

Node.js 14 的 V8 8.1 也原生支持了这些方法：

```javascript
// Array.flat() —— 数组扁平化
const nested = [1, [2, 3], [4, [5, 6]]];
nested.flat(); // [1, 2, 3, 4, [5, 6]]
nested.flat(2); // [1, 2, 3, 4, 5, 6]
nested.flat(Infinity); // 完全扁平化

// 实用场景：扁平化目录结构
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

// 实用：返回空数组时过滤掉
const ids = [1, 2, 3, 4, 5];
const results = ids.flatMap((id) => {
  const item = cache.get(id);
  return item ? [item] : []; // 没找到就返回空数组，相当于过滤
});
```

## globalThis

统一的全局对象访问方式：

```javascript
// 以前 —— 需要判断环境
let globalObj;
if (typeof window !== "undefined") {
  globalObj = window; // 浏览器
} else if (typeof global !== "undefined") {
  globalObj = global; // Node.js
} else if (typeof self !== "undefined") {
  globalObj = self; // Web Worker
}

// Node.js 14 —— globalThis
globalObj = globalThis; // 任何环境都适用

// 实用：跨环境的全局缓存
const GLOBAL_KEY = Symbol.for("__myAppCache__");
const cache = globalThis[GLOBAL_KEY] ?? (globalThis[GLOBAL_KEY] = new Map());
```

## String.matchAll()

```javascript
// 以前提取所有匹配项很麻烦
const text = '2020-07-20, 2020-08-17, 2020-09-14'
const regex = /(\d{4})-(\d{2})-(\d{2})/g

// 要用 exec 循环
let match
while ((match = regex.exec(text)) !== null) {
  console.log(match[1], match[2], match[3])
}

// Node.js 14 —— matchAll
for (const match of text.matchAll(regex)) {
  console.log(match[1], match[2], match[3])
}

// 转成数组
const dates = [...text.matchAll(regex)].map(m => ({
  full: m[0],
  year: m[1],
  month: m[2],
  day: m[3]
}))

// 实用：提取日志中的错误信息
function parseLogErrors(log: string) {
  const pattern = /\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]\s+ERROR:\s+(.+)/g
  return [...log.matchAll(pattern)].map(m => ({
    date: m[1],
    time: m[2],
    message: m[3]
  }))
}
```

## Intl.DisplayNames —— 国际化名称

```javascript
// 获取语言、地区、货币的本地化显示名称
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("US")); // 美国
console.log(regionNames.of("JP")); // 日本
console.log(regionNames.of("CN")); // 中国

const languageNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(languageNames.of("en")); // 英语
console.log(languageNames.of("ja")); // 日语
console.log(languageNames.of("zh")); // 中文

const currencyNames = new Intl.DisplayNames(["zh"], { type: "currency" });
console.log(currencyNames.of("CNY")); // 人民币
console.log(currencyNames.of("USD")); // 美元
```

## 在 tsconfig.json 中配置

如果项目用 TypeScript，需要注意配置以使用这些新特性：

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

## Summary

- Node.js 14 原生支持 Optional Chaining（`?.`）和 Nullish Coalescing（`??`），不再需要 Babel 转译
- `??` 和 `||` 的区别：`??` 只处理 null/undefined，`||` 处理所有 falsy 值
- `Array.flat()` 和 `Array.flatMap()` 原生可用，简化数组操作
- `globalThis` 提供了统一的全局对象访问方式
- `String.matchAll()` 让正则批量匹配变得优雅
- `Intl.DisplayNames` 方便国际化场景
- tsconfig 的 target 可以设置为 ES2020 来利用这些特性
