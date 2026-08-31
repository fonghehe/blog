---
title: "CSS Scroll Snap: Scroll Snapping Effects"
date: 2019-08-19 10:44:46
tags:
  - CSS
readingTime: 4
description: "Image carousels, full-screen scrolling pages, and horizontal scrolling cards—these common interaction patterns used to depend on JavaScript libraries. The CSS Scroll Snap property lets you achieve scroll-snapping effects with pure CSS, giving you better performance and cleaner code. By 2019, Scroll Snap enjoyed broad support across major browsers. This article systematically covers how Scroll Snap works."
wordCount: 400
---

Image carousels, full-screen scrolling pages, and horizontal scrolling cards—these common interaction patterns used to depend on JavaScript libraries. The CSS Scroll Snap property lets you achieve scroll-snapping effects with pure CSS, giving you better performance and cleaner code. By 2019, Scroll Snap enjoyed broad support across major browsers. This article systematically covers how Scroll Snap works, with real-world examples.

## Core Concepts

Scroll Snap revolves around two key properties:

- **`scroll-snap-type`** — set on the scroll container; defines the scroll axis and how strictly snapping is enforced.
- **`scroll-snap-align`** — set on the child elements; defines the snap position.

## Basic Usage: Horizontal Carousel

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

### Understanding scroll-snap-type

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

- **`mandatory`** — when scrolling stops, the position must snap to a snap point. Best for carousels, full-screen scrolling, and other precise scenarios.
- **`proximity`** — when scrolling stops it snaps if reasonably close, but won't force alignment when the position isn't precise enough. Best for naturally scrolling lists and similar scenarios.

### Understanding scroll-snap-align

```css
/* 语法 */
scroll-snap-align: <alignment>;

/* alignment: none | start | center | end | <value> <value> */
scroll-snap-align: start;    /* 子元素起始边对齐容器起始边 */
scroll-snap-align: center;   /* 子元素中心对齐容器中心 */
scroll-snap-align: end;      /* 子元素结束边对齐容器结束边 */
scroll-snap-align: start end; /* 第一个值：行内方向，第二个值：块方向 */
```

## Full-Screen Scroll Pages

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

## Card List Snap

Works well for product showcases, article lists, and similar scenarios:

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

## scroll-snap-stop: Preventing Scroll Pass-Through

By default, a fast swipe can skip several snap points. `scroll-snap-stop` lets you control this behavior:

```css
.slide {
  scroll-snap-align: start;
  /* normal: 允许跳过 | always: 每次必须停留 */
  scroll-snap-stop: always;
}
```

This property is especially useful when you want readers to go through content page by page, such as onboarding screens.

## scroll-padding and scroll-margin

### scroll-padding (set on the container)

Sets padding inside the scroll container. It doesn't affect layout but shifts where snapping happens:

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

### scroll-margin (set on the child)

Sets a margin for an individual child element:

```css
.section {
  scroll-snap-align: start;
  scroll-margin-top: 60px; /* 仅这个 section 有顶部偏移 */
}
```

## In Practice: Image Gallery

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

## Vertical Content Navigation

Pair it with a side navigation so clicking a nav item scrolls automatically:

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

## Browser Compatibility

Support as of August 2019:

- Chrome 69+ — full support
- Firefox 68+ — full support
- Safari 11+ — full support (requires `-webkit-` prefix)
- Edge 79+ — full support
- IE — not supported

For unsupported browsers, you can add progressive enhancement:

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

## Summary

- `scroll-snap-type`, set on the container, defines the scroll axis and snap strictness; `scroll-snap-align`, set on the children, defines the snap position.
- `mandatory` enforces strict snapping, ideal for carousels and other precise scenarios; `proximity` offers loose snapping, better for naturally scrolling lists.
- `scroll-snap-stop: always` prevents content from being skipped during a fast swipe.
- `scroll-padding` and `scroll-margin` handle offsets from fixed nav bars and similar cases.
- Use `@supports` for progressive enhancement; unsupported browsers still scroll normally, just without snapping.
- Pure-CSS implementation outperforms JavaScript approaches, so it's worth reaching for first in new projects.
