---
title: "CSS Scroll Snap 滾動吸附效果"
date: 2019-08-19 10:44:46
tags:
  - CSS
readingTime: 4
description: "圖片輪播、全屏滾動頁面、橫向滾動卡片——這些常見的互動效果過去往往需要依賴 JavaScript 庫實現。CSS Scroll Snap 屬性讓我們可以用純 CSS 實現滾動吸附效果，效能更好、程式碼更簡潔。2019 年，Scroll Snap 已經獲得了主流瀏覽器的廣泛支援。本文將系統講解 Scroll Snap 的"
wordCount: 644
---

圖片輪播、全屏滾動頁面、橫向滾動卡片——這些常見的互動效果過去往往需要依賴 JavaScript 庫實現。CSS Scroll Snap 屬性讓我們可以用純 CSS 實現滾動吸附效果，效能更好、程式碼更簡潔。2019 年，Scroll Snap 已經獲得了主流瀏覽器的廣泛支援。本文將系統講解 Scroll Snap 的用法和實戰案例。

## 核心概念

Scroll Snap 涉及兩個關鍵屬性：

- **`scroll-snap-type`** — 設定在滾動容器上，定義滾動軸和吸附嚴格程度
- **`scroll-snap-align`** — 設定在子元素上，定義吸附位置

## 基礎用法：水平輪播

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
  /* 設定滾動吸附 */
  scroll-snap-type: x mandatory;
  /* 隱藏捲軸（可選） */
  -webkit-overflow-scrolling: touch;
  /* 平滑滾動 */
  scroll-behavior: smooth;
}

/* 隱藏捲軸但保留滾動功能 */
.carousel::-webkit-scrollbar {
  display: none;
}

.slide {
  /* 每個 slide 佔滿一屏 */
  min-width: 100vw;
  height: 100vh;
  /* 設定吸附位置 */
  scroll-snap-align: start;
  /* 居中內容 */
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

### scroll-snap-type 詳解

```css
/* 語法 */
scroll-snap-type: <axis> <strictness>;

/* axis: x | y | block | inline | both */
scroll-snap-type: x;       /* 水平方向 */
scroll-snap-type: y;       /* 垂直方向 */
scroll-snap-type: both;    /* 兩個方向 */
scroll-snap-type: block;   /* 文本流方向（與 writing-mode 相關） */
scroll-snap-type: inline;  /* 行內方向 */

/* strictness: none | proximity | mandatory */
scroll-snap-type: x mandatory;   /* 嚴格吸附，必須對齊到吸附點 */
scroll-snap-type: x proximity;   /* 寬鬆吸附，儘量對齊但不強制 */
```

- **`mandatory`** — 滾動停止時必須對齊到吸附點。適用於輪播圖、全屏滾動等精確場景
- **`proximity`** — 滾動停止時儘量對齊，但位置不夠精確時不會強制調整。適用於長列表等自然滾動場景

### scroll-snap-align 詳解

```css
/* 語法 */
scroll-snap-align: <alignment>;

/* alignment: none | start | center | end | <value> <value> */
scroll-snap-align: start;    /* 子元素起始邊對齊容器起始邊 */
scroll-snap-align: center;   /* 子元素中心對齊容器中心 */
scroll-snap-align: end;      /* 子元素結束邊對齊容器結束邊 */
scroll-snap-align: start end; /* 第一個值：行內方向，第二個值：塊方向 */
```

## 全屏滾動頁面

```html
<div class="fullpage-scroll">
  <section class="section" id="home">首頁</section>
  <section class="section" id="about">關於</section>
  <section class="section" id="work">作品</section>
  <section class="section" id="contact">聯絡</section>
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

## 卡片列表吸附

適用於產品展示、文章列表等場景：

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
  scroll-snap-type: x proximity;  /* 寬鬆吸附 */
  /* 讓邊緣的卡片也能居中顯示 */
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

## scroll-snap-stop 控制滾動穿透

預設情況下，快速滑動可能跳過多個吸附點。`scroll-snap-stop` 可以控制這個行為：

```css
.slide {
  scroll-snap-align: start;
  /* normal: 允許跳過 | always: 每次必須停留 */
  scroll-snap-stop: always;
}
```

這個屬性特別適合需要使用者逐頁閱讀的場景，如新手引導頁。

## scroll-padding 和 scroll-margin

### scroll-padding（設定在容器上）

在滾動容器內設定內邊距，不影響佈局但影響吸附位置：

```css
/* 有固定導航欄時，避免內容被遮擋 */
.fullpage-scroll {
  scroll-snap-type: y mandatory;
  scroll-padding-top: 60px; /* 導航欄高度 */
}

.section {
  scroll-snap-align: start;
}
```

### scroll-margin（設定在子元素上）

為單個子元素設定外邊距：

```css
.section {
  scroll-snap-align: start;
  scroll-margin-top: 60px; /* 僅這個 section 有頂部偏移 */
}
```

## 實戰：圖片畫廊

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

## 垂直內容導航

配合側邊導航使用，實現點選導航自動滾動：

```html
<div class="layout">
  <nav class="side-nav">
    <a href="#section1">第一節</a>
    <a href="#section2">第二節</a>
    <a href="#section3">第三節</a>
  </nav>
  <main class="content">
    <section id="section1">內容一</section>
    <section id="section2">內容二</section>
    <section id="section3">內容三</section>
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

## 瀏覽器相容性

2019 年 8 月的支援情況：

- Chrome 69+ — 完整支援
- Firefox 68+ — 完整支援
- Safari 11+ — 完整支援（需要 `-webkit-` 字首）
- Edge 79+ — 完整支援
- IE — 不支援

對於不支援的瀏覽器，可以新增漸進增強：

```css
@supports (scroll-snap-type: x mandatory) {
  .carousel {
    scroll-snap-type: x mandatory;
  }
  .slide {
    scroll-snap-align: start;
  }
}

/* 不支援的瀏覽器仍然可以正常使用滾動，只是沒有吸附效果 */
```

## 小結

- `scroll-snap-type` 設定在容器上定義滾動軸和吸附嚴格度，`scroll-snap-align` 設定在子元素上定義吸附位置
- `mandatory` 嚴格吸附適用於輪播圖等精確場景，`proximity` 寬鬆吸附適用於列表等自然滾動場景
- `scroll-snap-stop: always` 可以防止快速滑動時跳過內容
- `scroll-padding` 和 `scroll-margin` 用於處理固定導航欄等偏移場景
- 使用 `@supports` 做漸進增強，不支援的瀏覽器仍可正常使用滾動功能
- 純 CSS 實現，效能優於 JavaScript 方案，推薦在新專案中優先使用
