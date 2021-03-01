---
title: "CSS clip-path 实现不规则形状"
date: 2019-07-18 11:17:09
tags:
  - CSS
---

传统的 CSS 裁切方式有限——`overflow: hidden` 只能做矩形裁切，`border-radius` 只能做圆角。如果你需要做斜边卡片、圆形头像裁切、波浪背景等不规则形状，`clip-path` 是目前最强大的方案。

## clip-path 基础

`clip-path` 允许你定义一个裁切区域，只显示区域内的内容。它支持五种基本形状函数：

### inset() — 矩形裁切

```css
.clip-inset {
  clip-path: inset(10% 20% 30% 40%);
  /* 上右下各裁切指定比例，类似 margin 的语法 */
}

/* 实际效果：图片四周各裁切一部分，只保留中心区域 */
.avatar {
  clip-path: inset(5% round 50%);
  /* round 后面跟圆角值 */
}
```

### circle() — 圆形裁切

```css
.avatar-circle {
  width: 100px;
  height: 100px;
  clip-path: circle(50% at 50% 50%);
  /* 圆心在中心，半径为 50% */
}

/* 简写：省略 at，默认在中心 */
.avatar-circle {
  clip-path: circle(50%);
}
```

### ellipse() — 椭圆裁切

```css
.ellipse-shape {
  clip-path: ellipse(60% 40% at 50% 50%);
  /* 水平半径 60%，垂直半径 40%，中心点在 50% 50% */
}
```

### polygon() — 多边形裁切（最强大）

```css
/* 三角形 */
.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  /* 三个顶点：上中、左下、右下 */
}

/* 梯形 */
.trapezoid {
  clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
}

/* 六边形 */
.hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* 箭头形状 */
.arrow {
  clip-path: polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%);
}
```

### url() — 引用 SVG

```css
.clip-svg {
  clip-path: url(#myClipPath);
}
```

```html
<svg width="0" height="0">
  <defs>
    <clipPath id="myClipPath">
      <path d="M50,0 L100,100 L0,100 Z" />
    </clipPath>
  </defs>
</svg>
```

## 实战一：斜边卡片

后台管理系统中常见的斜边标签页或卡片：

```html
<div class="tab-container">
  <div class="tab active">概览</div>
  <div class="tab">设置</div>
  <div class="tab">日志</div>
</div>
```

```css
.tab-container {
  display: flex;
  gap: 2px;
}

.tab {
  padding: 12px 40px;
  background: #e0e0e0;
  color: #666;
  cursor: pointer;
  position: relative;

  /* 两侧斜边效果 */
  clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
  transition: background 0.2s, color 0.2s;
}

.tab.active {
  background: #1890ff;
  color: #fff;
}

.tab:hover:not(.active) {
  background: #d0d0d0;
}
```

## 实战二：波浪背景

活动页面常见的波浪形分隔线，传统做法是用 SVG 背景图或伪元素 + border-radius。用 `clip-path` 更灵活：

```html
<div class="hero-section">
  <div class="wave-background"></div>
  <div class="content">
    <h1>活动标题</h1>
    <p>活动描述文字</p>
  </div>
</div>
```

```css
.hero-section {
  position: relative;
  height: 500px;
  overflow: hidden;
}

.wave-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* 波浪形裁切 */
  clip-path: polygon(
    0% 0%,
    100% 0%,
    100% 75%,
    80% 80%,
    60% 85%,
    40% 82%,
    20% 88%,
    0% 83%
  );
}

.content {
  position: relative;
  z-index: 1;
  color: #fff;
  text-align: center;
  padding-top: 150px;
}
```

## 实战三：产品卡片裁切

电商产品展示中常见的不规则卡片：

```html
<div class="product-grid">
  <div class="product-card">
    <div class="product-image">
      <img src="product1.jpg" alt="产品1" />
    </div>
    <div class="product-info">
      <h3>产品名称</h3>
      <p class="price">99.00</p>
    </div>
  </div>
</div>
```

```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.product-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s;
}

.product-card:hover {
  transform: translateY(-4px);
}

.product-image {
  height: 240px;
  overflow: hidden;
  position: relative;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;

  /* 底部斜切效果，让图片和下方内容形成流畅过渡 */
  clip-path: polygon(0% 0%, 100% 0%, 100% 85%, 0% 100%);
}

.product-info {
  padding: 16px 20px;
  margin-top: -20px; /* 拉近与图片的距离 */
}

.price {
  color: #e74c3c;
  font-size: 24px;
  font-weight: bold;
}
```

## 动画过渡

`clip-path` 支持 CSS transition 和 animation，前提是**形状函数相同且顶点数量一致**：

```css
/* 动画效果：悬停时从圆形展开为方形 */
.expand-on-hover {
  width: 200px;
  height: 200px;
  background: #1890ff;
  clip-path: circle(10% at 50% 50%);
  transition: clip-path 0.4s ease;
}

.expand-on-hover:hover {
  clip-path: circle(75% at 50% 50%);
}
```

```css
/* 多边形之间的过渡也可以工作 */
.shape-morph {
  background: linear-gradient(45deg, #f093fb, #f5576c);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  transition: clip-path 0.5s ease;
}

.shape-morph:hover {
  clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
}
```

**踩过的坑：** 从 `circle()` 过渡到 `polygon()` 是不行的，因为两种形状函数无法插值。必须保持函数类型一致：

```css
/* 错误：不能过渡 */
clip-path: circle(50%) → clip-path: polygon(...)

/* 正确：都是 circle */
clip-path: circle(10%) → clip-path: circle(75%)
```

## 关键帧动画

```css
@keyframes clipReveal {
  0% {
    clip-path: polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%);
  }
  100% {
    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
  }
}

.reveal-animation {
  animation: clipReveal 0.8s ease-out forwards;
}
```

这个效果是从左到右展开显示，适合页面元素的入场动画。

## 实战四：文字沿形状排列

虽然 `clip-path` 本身不控制文字排列，但配合 `shape-outside` 可以实现文字环绕不规则形状：

```css
.float-shape {
  width: 200px;
  height: 200px;
  float: left;
  background: #1890ff;

  /* 视觉裁切 */
  clip-path: circle(50%);

  /* 文字环绕的形状（需要和 clip-path 一致） */
  shape-outside: circle(50%);
}
```

```html
<div class="article">
  <div class="float-shape"></div>
  <p>这段文字会环绕在圆形元素的周围，而不是简单的矩形环绕。shape-outside
  定义了浮动元素周围的环绕形状，让文字自然地贴合不规则的边缘。</p>
</div>
```

## 兼容性

截至 2019 年中：

| 浏览器 | 支持情况 |
|--------|----------|
| Chrome | 55+ (完整支持) |
| Firefox | 54+ (完整支持) |
| Safari | 9.1+ (需要 -webkit- 前缀) |
| Edge | 12+ (部分支持) |
| IE | 不支持 |

```css
/* 完整兼容写法 */
.element {
  -webkit-clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
}

/* IE 降级 */
@supports not (clip-path: polygon(0% 0%)) {
  .element {
    /* 使用 overflow: hidden + border-radius 等传统方案 */
  }
}
```

## 小结

- `clip-path` 支持 `inset()`、`circle()`、`ellipse()`、`polygon()`、`url()` 五种形状函数
- `polygon()` 最强大，可以定义任意多边形，用百分比或长度值指定顶点
- 支持 CSS transition 动画，但要求形状函数类型相同、顶点数量一致
- 配合 `shape-outside` 可以实现文字环绕不规则形状
- Safari 需要 `-webkit-` 前缀，IE 完全不支持，需要降级方案
- 适合斜边卡片、波浪背景、图片裁切、入场动画等场景
