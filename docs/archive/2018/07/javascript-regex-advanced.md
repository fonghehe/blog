---
title: "JavaScript 正则表达式进阶"
date: 2018-07-14 09:32:14
tags:
  - JavaScript
readingTime: 1
description: "基础正则表达式会写了，但工作中遇到复杂需求还是懵。整理一些进阶用法。"
wordCount: 124
---

基础正则表达式会写了，但工作中遇到复杂需求还是懵。整理一些进阶用法。

## 常用特殊字符

```javascript
// 字符类
\d  数字 [0-9]
\w  单词字符 [A-Za-z0-9_]
\s  空白字符（空格、Tab、换行）
\D  非数字，\W 非单词字符，\S 非空白

// 量词
?   0或1次
*   0或多次
+   1或多次
{n} 恰好n次
{n,m} n到m次

// 锚点
^   开头
$   结尾
\b  单词边界
```

## 捕获组

```javascript
// 捕获组：提取匹配的部分
const date = "2018-07-14";
const match = date.match(/(\d{4})-(\d{2})-(\d{2})/);
// match[0]: '2018-07-14'（完整匹配）
// match[1]: '2018'（第一组）
// match[2]: '07'（第二组）
// match[3]: '14'（第三组）

// 命名捕获组（ES2018）
const match2 = date.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
console.log(match2.groups.year); // '2018'
console.log(match2.groups.month); // '07'
```

## 替换中使用捕获组

```javascript
// 日期格式转换：2018-07-14 → 07/14/2018
"2018-07-14".replace(/(\d{4})-(\d{2})-(\d{2})/, "$2/$3/$1");
// '07/14/2018'

// 手机号脱敏：138****8888
"13812345678".replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
// '138****5678'
```

## 非贪婪匹配

```javascript
// 贪婪（默认）：尽可能多匹配
"<a>文字</a><b>加粗</b>".match(/<.+>/);
// ['<a>文字</a><b>加粗</b>']  整个被匹配了

// 非贪婪（加 ?）：尽可能少匹配
"<a>文字</a><b>加粗</b>".match(/<.+?>/);
// ['<a>']  只匹配第一个
```

## 常用正则

```javascript
// 邮箱
const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 手机号（中国大陆）
const phoneReg = /^1[3-9]\d{9}$/;

// URL
const urlReg = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;

// 身份证（简单版）
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

// match：返回匹配数组
str.match(/hello/g); // ['hello', 'hello']

// replace：替换
str.replace(/hello/g, "hi"); // 'hi world hi'

// split：分割
"a,b;c d".split(/[,; ]/); // ['a', 'b', 'c', 'd']

// matchAll（ES2020）：返回所有匹配的详细信息
const matches = [...str.matchAll(/hello/g)];
```

## 小结

- 命名捕获组 `(?<name>...)` 让代码更可读
- 非贪婪 `+?` `*?` 解决贪婪匹配问题
- `g` 标志全局匹配，`i` 忽略大小写，`m` 多行
- 复杂正则要加注释或用正则工具（如 regex101.com）测试