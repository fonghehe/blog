---
title: "JavaScript 正規表示式實踐"
date: 2018-06-16 10:11:40
tags:
  - JavaScript
readingTime: 1
description: "正規表示式一直是個\"會忘記\"的知識點，整理常用模式和實際場景。"
wordCount: 103
---

正規表示式一直是個"會忘記"的知識點，整理常用模式和實際場景。

## 基礎語法

```javascript
// 兩種建立方式
const re1 = /pattern/flags    // 字面量（推薦）
const re2 = new RegExp('pattern', 'flags')  // 動態建立時用

// 常用修飾符
// i：忽略大小寫
// g：全域性匹配（不加 g 隻找第一個）
// m：多行模式（^ $ 匹配行首行尾）
// s：. 匹配換行符（ES2018）
```

## 常用字元類

```javascript
// 元字元
\d  // 數字 [0-9]
\w  // 字母數字下劃線 [a-zA-Z0-9_]
\s  // 空白字元（空格、Tab、換行）
\b  // 單詞邊界
.   // 任意字元（除換行，加 s 修飾符後包含換行）

// 量詞
*   // 0 個或多個
+   // 1 個或多個
?   // 0 個或 1 個
{n} // 恰好 n 個
{n,m} // n 到 m 個
{n,}  // n 個或更多

// 非貪婪（加 ? 變懶）
.*?  // 匹配儘可能少
```

## 常用方法

```javascript
const str = 'Hello World 2018'

// test：是否匹配，返回布林值
/\d+/.test(str)          // true

// match：提取匹配結果
str.match(/\d+/)         // ['2018']
str.match(/[A-Z]/g)      // ['H', 'W']

// replace：替換
str.replace(/\d+/, '2019')    // 'Hello World 2019'
str.replace(/[a-z]/g, '*')    // 'H**** W**** ****'

// 用函式替換（強大）
'hello_world'.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
// 'helloWorld'（下劃線轉駝峰）

// split：分割
'a, b , c'.split(/\s*,\s*/)   // ['a', 'b', 'c']

// matchAll（ES2020，現在用迴圈代替）
const re = /(\d+)-(\d+)/g
let m
while ((m = re.exec(str)) !== null) {
  console.log(m[1], m[2])
}
```

## 實際場景

```javascript
// 驗證手機號（中國大陸）
const isMobile = /^1[3-9]\d{9}$/.test(phone);

// 驗證郵箱（簡化版，別用太嚴格的）
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 提取 URL 引數
function getQueryParam(name) {
  const re = new RegExp(`[?&]${name}=([^&]*)`);
  const match = location.search.match(re);
  return match ? decodeURIComponent(match[1]) : null;
}

// 脫敏手機號：138****8888
phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

// 數字千分位：1234567 → 1,234,567
String(num).replace(/\B(?=(\d{3})+$)/g, ",");

// 駝峰轉連字元：camelCase → camel-case
str.replace(/([A-Z])/g, "-$1").toLowerCase();

// 去除 HTML 標籤
html.replace(/<[^>]+>/g, "");
```

## 命名捕獲組（ES2018）

```javascript
// 解析日期字串
const dateRe = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const {
  groups: { year, month, day },
} = "2018-06-16".match(dateRe);

// 替換時使用命名組
"2018-06-16".replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  "$<day>/$<month>/$<year>",
);
// '16/06/2018'
```

## 小結

- `test()` 判斷是否匹配，`match()` 提取，`replace()` 替換
- 加 `g` 修飾符才能全域性匹配
- 命名捕獲組 `(?<name>...)` 讓程式碼更易讀
- 線上工具 regex101.com 除錯正則很方便
