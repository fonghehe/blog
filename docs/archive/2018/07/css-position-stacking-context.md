---
title: "CSS position 定位与层叠上下文"
date: 2018-07-05 10:44:49
tags:
  - CSS
readingTime: 1
description: "`position` 是前端必知必会的属性，但 `z-index` 失效的问题坑了不少人。"
---

`position` 是前端必知必会的属性，但 `z-index` 失效的问题坑了不少人。

## 五种定位方式

```css
/* static：默认，不参与 z-index 堆叠 */
position: static;

/* relative：相对自身原始位置偏移，不脱离文档流 */
position: relative;
top: 10px; /* 向下移 10px，原位置仍占据空间 */

/* absolute：相对最近的非 static 祖先定位，脱离文档流 */
position: absolute;
top: 0;
right: 0; /* 右上角 */

/* fixed：相对视口定位，脱离文档流，滚动不跟随 */
position: fixed;
bottom: 20px;
right: 20px; /* 固定在右下角 */

/* sticky：滚动到阈值前是 relative，之后变 fixed */
position: sticky;
top: 60px; /* 滚动到距视口顶部 60px 时固定 */
```

## absolute 定位的参照系

找最近的 **非 static** 祖先：

```html
<div class="parent" style="position: relative;">
  <!-- 参照这个 -->
  <div class="child" style="position: absolute; top: 10px; left: 10px;"></div>
</div>
```

如果没有非 static 祖先，就相对 `<html>` 定位。

## 层叠上下文（Stacking Context）

`z-index` 失效通常是不理解层叠上下文导致的。

创建层叠上下文的条件（常见的）：

- `position: relative/absolute/fixed` + `z-index` 不为 auto
- `opacity < 1`
- `transform: translate/rotate/scale` 等
- `filter` 非 none
- `will-change`

```html
<div style="position: relative; z-index: 1;">
  <!-- 这里有自己的层叠上下文 -->
  <div style="position: absolute; z-index: 999;">
    <!-- z-index: 999 只在父级上下文内有效 -->
    <!-- 无法超过兄弟的 z-index: 2 -->
  </div>
</div>
<div style="position: relative; z-index: 2;">
  <!-- 这个在 z-index: 999 的元素之上 -->
</div>
```

**理解关键**：子元素的 `z-index` 只在父层叠上下文内比较，无法跳出。

## 常见陷阱：transform 创建层叠上下文

```css
/* 父元素有 transform，子元素 fixed 失效！ */
.parent {
  transform: translateZ(0); /* 或 will-change: transform */
}
.child {
  position: fixed; /* 变成相对 parent 定位，而非视口 */
}
```

## 实用技巧

```css
/* 垂直水平居中（absolute 经典做法） */
.centered {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 固定底部导航（Safari 安全区域处理） */
.bottom-nav {
  position: fixed;
  bottom: 0;
  bottom: env(safe-area-inset-bottom); /* iOS 刘海屏 */
  width: 100%;
}

/* sticky 表头 */
thead th {
  position: sticky;
  top: 0;
  background: white; /* 必须有背景色，否则会透明 */
  z-index: 1;
}
```

## 小结

- `absolute` 找最近的非 static 祖先
- 层叠上下文隔离了内部的 `z-index`，这是 z-index 失效的根本原因
- `transform`、`opacity < 1`、`filter` 都会创建层叠上下文
- `sticky` 需要父元素有确定的高度且不能 `overflow: hidden`
