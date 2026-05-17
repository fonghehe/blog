---
title: "CSS Scroll Snap：スクロールスナップ効果"
date: 2019-08-19 10:44:46
tags:
  - CSS
readingTime: 4
description: "图片轮播、全屏滚动页面、横向滚动卡片——这些常见的交互效果过去往往需要依赖 JavaScript 库实现。CSS Scroll Snap 属性让我们可以用纯 CSS 实现滚动吸附效果，性能更好、代码更简洁。2019 年，Scroll Snap 已经获得了主流浏览器的广泛支持。本文将系统讲解 Scroll Snap 的用"
---

图片轮播、全屏滚动页面、横向滚动卡片——这些常见的交互效果过去往往需要依赖 JavaScript 库实现。CSS Scroll Snap 属性让我们可以用纯 CSS 实现滚动吸附效果，性能更好、代码更简洁。2019 年，Scroll Snap 已经获得了主流浏览器的广泛支持。本文将系统讲解 Scroll Snap 的用法和实战案例。

## コアコンセプト

Scroll Snap 涉及两个关键属性：

- **`scroll-snap-type`** — 设置在滚动容器上，定义滚动轴和吸附严格程度
- **`scroll-snap-align`** — 设置在子元素上，定义吸附位置

## 基本的な使い方：横スクロールカルーセル

```html
<div class="carousel">
  <div class="slide slide-1">Slide 1</div>
  <div class="slide slide-2">Slide 2</div>
  <div class="slide slide-3">Slide 3</div>
  <div class="slide slide-4">Slide 4</div>
</div>
```

```css
.carousel {
  display: flex;
  overflow-x: auto;
  /* 设置滚动吸附 */
  scroll-snap-type: x mandatory;
  /* 隐藏滚动条（可选） */
  -webkit-overflow-scrolling: touch;
  /* 平滑滚动 */
  scroll-behavior: smooth;
}

/* 隐藏滚动条但保留滚动功能 */
.carousel::-webkit-scrollbar {
  display: none;
}

.slide {
  /* 每个 slide 占满一屏 */
  min-width: 100vw;
  height: 100vh;
  /* 设置吸附位置 */
  scroll-snap-align: start;
  /* 居中内容 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.slide-1 { background: #ff6b6b; color: white; }
.slide-2 { background: #4ecdc4; color: white; }
.slide-3 { background: #45b7d1; color: white; }
.slide-4 { background: #96ceb4; color: white; }
```

### scroll-snap-type 详解

```css
/* 语法 */
scroll-snap-type: <axis> <strictness>;

/* axis: x | y | block | inline | both */
scroll-snap-type: x;       /* 水平方向 */
scroll-snap-type: y;       /* 垂直方向 */
scroll-snap-type: both;    /* 两个方向 */
scroll-snap-type: block;   /* 文本流方向（与 writing-mode 相关） */
scroll-snap-type: inline;  /* 行内方向 */

/* strictness: none | proximity | mandatory */
scroll-snap-type: x mandatory;   /* 严格吸附，必须对齐到吸附点 */
scroll-snap-type: x proximity;   /* 宽松吸附，尽量对齐但不强制 */
```

- **`mandatory`** — 滚动停止时必须对齐到吸附点。适用于轮播图、全屏滚动等精确场景
- **`proximity`** — 滚动停止时尽量对齐，但位置不够精确时不会强制调整。适用于长列表等自然滚动场景

### scroll-snap-align 详解

```css
/* 语法 */
scroll-snap-align: <alignment>;

/* alignment: none | start | center | end | <value> <value> */
scroll-snap-align: start;    /* 子元素起始边对齐容器起始边 */
scroll-snap-align: center;   /* 子元素中心对齐容器中心 */
scroll-snap-align: end;      /* 子元素结束边对齐容器结束边 */
scroll-snap-align: start end; /* 第一个值：行内方向，第二个值：块方向 */
```

## フルスクリーンスクロールページ

```html
<div class="fullpage-scroll">
  <section class="section" id="home">首页</section>
  <section class="section" id="about">关于</section>
  <section class="section" id="work">作品</section>
  <section class="section" id="contact">联系</section>
</div>
```

```css
.fullpage-scroll {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
}

.section {
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

#home { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
#about { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
#work { background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; }
#contact { background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; }
```

## カードリストのスナップ

适用于产品展示、文章列表等场景：

```html
<div class="card-container">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
  <div class="card">Card 4</div>
  <div class="card">Card 5</div>
</div>
```

```css
.card-container {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 20px;
  scroll-snap-type: x proximity;  /* 宽松吸附 */
  /* 让边缘的卡片也能居中显示 */
  scroll-padding: 0 calc(50% - 150px);
}

.card {
  min-width: 300px;
  height: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  scroll-snap-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: transform 0.3s;
}

.card:hover {
  transform: scale(1.02);
}
```

## scroll-snap-stop：スクロール通過の制御

默认情况下，快速滑动可能跳过多个吸附点。`scroll-snap-stop` 可以控制这个行为：

```css
.slide {
  scroll-snap-align: start;
  /* normal: 允许跳过 | always: 每次必须停留 */
  scroll-snap-stop: always;
}
```

这个属性特别适合需要用户逐页阅读的场景，如新手引导页。

## scroll-padding と scroll-margin

### scroll-padding（设置在容器上）

在滚动容器内设置内边距，不影响布局但影响吸附位置：

```css
/* 有固定导航栏时，避免内容被遮挡 */
.fullpage-scroll {
  scroll-snap-type: y mandatory;
  scroll-padding-top: 60px; /* 导航栏高度 */
}

.section {
  scroll-snap-align: start;
}
```

### scroll-margin（设置在子元素上）

为单个子元素设置外边距：

```css
.section {
  scroll-snap-align: start;
  scroll-margin-top: 60px; /* 仅这个 section 有顶部偏移 */
}
```

## 実践：画像ギャラリー

```html
<div class="gallery">
  <div class="gallery-item">
    <img src="photo1.jpg" alt="照片1">
  </div>
  <div class="gallery-item">
    <img src="photo2.jpg" alt="照片2">
  </div>
  <div class="gallery-item">
    <img src="photo3.jpg" alt="照片3">
  </div>
</div>
```

```css
.gallery {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 10px;
  padding: 10px;
  scroll-padding: 10px;
}

.gallery-item {
  scroll-snap-align: center;
  scroll-snap-stop: always;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
}

.gallery-item img {
  height: 300px;
  width: auto;
  object-fit: cover;
  display: block;
}
```

## 縦コンテンツナビゲーション

配合侧边导航使用，实现点击导航自动滚动：

```html
<div class="layout">
  <nav class="side-nav">
    <a href="#section1">第一节</a>
    <a href="#section2">第二节</a>
    <a href="#section3">第三节</a>
  </nav>
  <main class="content">
    <section id="section1">内容一</section>
    <section id="section2">内容二</section>
    <section id="section3">内容三</section>
  </main>
</div>
```

```css
.content {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}

section {
  min-height: 100vh;
  scroll-snap-align: start;
  padding: 40px;
  border-bottom: 1px solid #eee;
}
```

## ブラウザ互換性

2019 年 8 月的支持情况：

- Chrome 69+ — 完整支持
- Firefox 68+ — 完整支持
- Safari 11+ — 完整支持（需要 `-webkit-` 前缀）
- Edge 79+ — 完整支持
- IE — 不支持

对于不支持的浏览器，可以添加渐进增强：

```css
@supports (scroll-snap-type: x mandatory) {
  .carousel {
    scroll-snap-type: x mandatory;
  }
  .slide {
    scroll-snap-align: start;
  }
}

/* 不支持的浏览器仍然可以正常使用滚动，只是没有吸附效果 */
```

## まとめ

- `scroll-snap-type` 设置在容器上定义滚动轴和吸附严格度，`scroll-snap-align` 设置在子元素上定义吸附位置
- `mandatory` 严格吸附适用于轮播图等精确场景，`proximity` 宽松吸附适用于列表等自然滚动场景
- `scroll-snap-stop: always` 可以防止快速滑动时跳过内容
- `scroll-padding` 和 `scroll-margin` 用于处理固定导航栏等偏移场景
- 使用 `@supports` 做渐进增强，不支持的浏览器仍可正常使用滚动功能
- 纯 CSS 实现，性能优于 JavaScript 方案，推荐在新项目中优先使用
