---
title: "JavaScript 正则表达式实践"
date: 2018-06-16 10:11:40
tags:
  - JavaScript
readingTime: 1
description: "正则表达式一直是个\"会忘记\"的知识点，整理常用模式和实际场景。"
---

正则表达式一直是个"会忘记"的知识点，整理常用模式和实际场景。

## 基础语法

```javascript
// 两种创建方式
const re1 = /pattern/flags    // 字面量（推荐）
const re2 = new RegExp('pattern', 'flags')  // 动态创建时用

// 常用修饰符
// i：忽略大小写
// g：全局匹配（不加 g 只找第一个）
// m：多行模式（^ $ 匹配行首行尾）
// s：. 匹配换行符（ES2018）
```

## 常用字符类

```javascript
// 元字符
\d  // 数字 [0-9]
\w  // 字母数字下划线 [a-zA-Z0-9_]
\s  // 空白字符（空格、Tab、换行）
\b  // 单词边界
.   // 任意字符（除换行，加 s 修饰符后包含换行）

// 量词
*   // 0 个或多个
+   // 1 个或多个
?   // 0 个或 1 个
{n} // 恰好 n 个
{n,m} // n 到 m 个
{n,}  // n 个或更多

// 非贪婪（加 ? 变懒）
.*?  // 匹配尽可能少
```

## 常用方法

```javascript
const str = 'Hello World 2018'

// test：是否匹配，返回布尔值
/\d+/.test(str)          // true

// match：提取匹配结果
str.match(/\d+/)         // ['2018']
str.match(/[A-Z]/g)      // ['H', 'W']

// replace：替换
str.replace(/\d+/, '2019')    // 'Hello World 2019'
str.replace(/[a-z]/g, '*')    // 'H**** W**** ****'

// 用函数替换（强大）
'hello_world'.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
// 'helloWorld'（下划线转驼峰）

// split：分割
'a, b , c'.split(/\s*,\s*/)   // ['a', 'b', 'c']

// matchAll（ES2020，现在用循环代替）
const re = /(\d+)-(\d+)/g
let m
while ((m = re.exec(str)) !== null) {
  console.log(m[1], m[2])
}
```

## 实际场景

```javascript
// 验证手机号（中国大陆）
const isMobile = /^1[3-9]\d{9}$/.test(phone);

// 验证邮箱（简化版，别用太严格的）
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 提取 URL 参数
function getQueryParam(name) {
  const re = new RegExp(`[?&]${name}=([^&]*)`);
  const match = location.search.match(re);
  return match ? decodeURIComponent(match[1]) : null;
}

// 脱敏手机号：138****8888
phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

// 数字千分位：1234567 → 1,234,567
String(num).replace(/\B(?=(\d{3})+$)/g, ",");

// 驼峰转连字符：camelCase → camel-case
str.replace(/([A-Z])/g, "-$1").toLowerCase();

// 去除 HTML 标签
html.replace(/<[^>]+>/g, "");
```

## 命名捕获组（ES2018）

```javascript
// 解析日期字符串
const dateRe = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const {
  groups: { year, month, day },
} = "2018-06-16".match(dateRe);

// 替换时使用命名组
"2018-06-16".replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  "$<day>/$<month>/$<year>",
);
// '16/06/2018'
```

## 小结

- `test()` 判断是否匹配，`match()` 提取，`replace()` 替换
- 加 `g` 修饰符才能全局匹配
- 命名捕获组 `(?<name>...)` 让代码更易读
- 在线工具 regex101.com 调试正则很方便
