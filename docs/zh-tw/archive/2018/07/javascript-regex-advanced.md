---
title: "JavaScript 正規表示式進階"
date: 2018-07-14 09:32:14
tags:
  - JavaScript
readingTime: 1
description: "基礎正規表示式會寫了，但工作中遇到複雜需求還是懵。整理一些進階用法。"
---

基礎正規表示式會寫了，但工作中遇到複雜需求還是懵。整理一些進階用法。

## 常用特殊字元

```javascript
// 字元類
\d  數字 [0-9]
\w  單詞字元 [A-Za-z0-9_]
\s  空白字元（空格、Tab、換行）
\D  非數字，\W 非單詞字元，\S 非空白

// 量詞
?   0或1次
*   0或多次
+   1或多次
{n} 恰好n次
{n,m} n到m次

// 錨點
^   開頭
$   結尾
\b  單詞邊界
```

## 捕獲組

```javascript
// 捕獲組：提取匹配的部分
const date = "2018-07-14";
const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
// match[0]: '2018-07-14'（完整匹配）
// match[1]: '2018'（第一組）
// match[2]: '07'（第二組）
// match[3]: '14'（第三組）

// 命名捕獲組（ES2018）
const match2 = date.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
console.log(match2.groups.year); // '2018'
console.log(match2.groups.month); // '07'
```

## 替換中使用捕獲組

```javascript
// 日期格式轉換：2018-07-14 → 07/14/2018
"2018-07-14".replace(/(\d{4})-(\d{2})-(\d{2})/, "$2/$3/$1");
// '07/14/2018'

// 手機號脫敏：138****8888
"13812345678".replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
// '138****5678'
```

## 非貪婪匹配

```javascript
// 貪婪（預設）：儘可能多匹配
"<a>文字</a><b>加粗</b>".match(/<.+>/);
// ['<a>文字</a><b>加粗</b>']  整個被匹配了

// 非貪婪（加 ?）：儘可能少匹配
"<a>文字</a><b>加粗</b>".match(/<.+?>/);
// ['<a>']  只匹配第一個
```

## 常用正則

```javascript
// 郵箱
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 手機號（中國大陸）
const phoneReg = /^1[3-9]\d{9}$/;

// URL
const urlReg = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;

// 身份證（簡單版）
const idCardReg = /^\d{17}[\dX]$/;

// 用法
function validateEmail(email) {
  return emailReg.test(email);
}
```

## 常用方法

```javascript
const str = "hello world hello";
const reg = /hello/g;

// test：是否匹配
reg.test(str); // true

// match：返回匹配陣列
str.match(/hello/g); // ['hello', 'hello']

// replace：替換
str.replace(/hello/g, "hi"); // 'hi world hi'

// split：分割
"a,b;c d".split(/[,; ]/); // ['a', 'b', 'c', 'd']

// matchAll（ES2020）：返回所有匹配的詳細資訊
const matches = [...str.matchAll(/hello/g)];
```

## 小結

- 命名捕獲組 `(?<name>...)` 讓程式碼更可讀
- 非貪婪 `+?` `*?` 解決貪婪匹配問題
- `g` 標誌全域性匹配，`i` 忽略大小寫，`m` 多行
- 複雜正則要加註釋或用正則工具（如 regex101.com）測試