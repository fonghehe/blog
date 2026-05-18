---
title: "CSS 选择器优先级"
date: 2018-05-06 14:48:34
tags:
  - CSS
readingTime: 1
description: "CSS 样式不生效，大概率是优先级问题。这篇文章把优先级规则说清楚。"
---

CSS 样式不生效，大概率是优先级问题。这篇文章把优先级规则说清楚。

## 优先级权重

| 选择器类型   | 权重             | 示例                                 |
| 
------------ | ---------------- | ------------------------------------ |
| !important   | 最高（覆盖一切） | `color: red !important`              |
| 内联样式     | 1000             | `style="color: red"`                 |
| ID 选择器    | 100              | `#header`                            |
| 类/属性/伪类 | 10               | `.active`, `[type="text"]`, `:hover` |
| 元素/伪元素  | 1                | `div`, `p`, `::before`               |
| 通配符       | 0                | `*`                                  |

## 计算方法

权重是三位数分别计数（不是相加成十进制）：

```
格式：(内联, ID, 类/属性/伪类, 元素)

a { color: red }                    → (0, 0, 0, 1)
.nav a { color: red }               → (0, 0, 1, 1)
#header .nav a { color: red }       → (0, 1, 1, 1)
```

比较时从高位开始，高位大的优先：

```css
/* 哪个会生效？ */
#header a {
  color: blue;
} /* (0, 1, 0, 1) */
.nav .link a {
  color: red;
} /* (0, 0, 2, 1) */

/* 结果：#header a 生效，因为 ID 位 1 > 0 */
```

## 同等优先级：后写的覆盖前写的

```css
.btn {
  color: red;
}
.btn {
  color: blue;
} /* 后写的生效，按钮是蓝色 */
```

## 实际场景

```css
/* 场景：组件库的样式被业务样式覆盖 */

/* Element UI 里的按钮 */
.el-button {
  color: #409eff;
}

/* 你的覆盖 */
.el-button {
  color: red;
} /* 不生效！因为 css 引入顺序，组件库可能在后面 */

/* 强制覆盖（不推荐，但有时不得不用）*/
.el-button {
  color: red !important;
}

/* 更好的方式：增加特异性 */
.my-page .el-button {
  color: red;
} /* 加父级选择器提高权重 */
```

## !important 的使用原则

```css
/* ❌ 滥用 !important 的恶性循环 */
.btn {
  color: red !important;
}
.special-btn {
  color: blue !important;
}
/* 都加了 !important，又回到后写覆盖前写的问题 */

/* ✅ !important 的正当用途 */
/* 工具类：明确就是要强制覆盖 */
.text-center {
  text-align: center !important;
}
.hidden {
  display: none !important;
}
```

## 常见误区

```css
/* 误区：以为层级越多权重越高 */
div div div div {
  color: red;
} /* (0, 0, 0, 4) */
.active {
  color: blue;
} /* (0, 0, 1, 0) */

/* 结果：.active 生效，类选择器 > 元素选择器 */

/* 误区：伪元素 ::before 和伪类 :hover 权重 */
a::before {
} /* 权重 1（伪元素） */
a:hover {
} /* 权重 10（伪类） */
```

## 开发建议

```
1. 不要轻易用 !important，它会导致维护困难
2. 用 BEM 命名，降低嵌套深度，减少优先级冲突
3. 碰到不生效，先用 DevTools 查看哪条规则被覆盖了
4. 组件库样式覆盖，用加父级选择器代替 !important
```

## 小结

- 权重从高到低：!important > 内联 > ID(100) > 类/属性/伪类(10) > 元素(1)
- 相同权重：后写的覆盖前写的
- 权重比较是按位比较，不是简单相加
- `!important` 能不用就不用，遇到问题先提高特异性