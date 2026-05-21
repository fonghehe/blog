---
title: "CSS clip-path 實現不規則形狀"
date: 2019-07-18 11:17:09
tags:
  - CSS
readingTime: 3
description: "傳統的 CSS 裁切方式有限——`overflow: hidden` 只能做矩形裁切，`border-radius` 只能做圓角。如果你需要做斜邊卡片、圓形頭像裁切、波浪背景等不規則形狀，`clip-path` 是目前最強大的方案。"
wordCount: 530
---

傳統的 CSS 裁切方式有限——`overflow: hidden` 只能做矩形裁切，`border-radius` 只能做圓角。如果你需要做斜邊卡片、圓形頭像裁切、波浪背景等不規則形狀，`clip-path` 是目前最強大的方案。

## clip-path 基礎

`clip-path` 允許你定義一個裁切區域，只顯示區域內的內容。它支持五種基本形狀函數：

### inset() — 矩形裁切

```css
.clip-inset {
  clip-path: inset(10% 20% 30% 40%);
  /* 上右下各裁切指定比例，類似 margin 的語法 */
}

/* 實際效果：圖片四周各裁切一部分，只保留中心區域 */
.avatar {
  clip-path: inset(5% round 50%);
  /* round 後面跟圓角值 */
}
```

### circle() — 圓形裁切

```css
.avatar-circle {
  width: 100px;
  height: 100px;
  clip-path: circle(50% at 50% 50%);
  /* 圓心在中心，半徑為 50% */
}

/* 簡寫：省略 at，默認在中心 */
.avatar-circle {
  clip-path: circle(50%);
}
```

### ellipse() — 橢圓裁切

```css
.ellipse-shape {
  clip-path: ellipse(60% 40% at 50% 50%);
  /* 水平半徑 60%，垂直半徑 40%，中心點在 50% 50% */
}
```

### polygon() — 多邊形裁切（最強大）

```css
/* 三角形 */
.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  /* 三個頂點：上中、左下、右下 */
}

/* 梯形 */
.trapezoid {
  clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
}

/* 六邊形 */
.hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* 箭頭形狀 */
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

## 實戰一：斜邊卡片

後台管理系統中常見的斜邊標籤頁或卡片：

```html
<div class="tab-container">
  <div class="tab active">概覽</div>
  <div class="tab">設置</div>
  <div class="tab">日誌</div>
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

  /* 兩側斜邊效果 */
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

## 實戰二：波浪背景

活動頁面常見的波浪形分隔線，傳統做法是用 SVG 背景圖或偽元素 + border-radius。用 `clip-path` 更靈活：

```html
<div class="hero-section">
  <div class="wave-background"></div>
  <div class="content">
    <h1>活動標題</h1>
    <p>活動描述文字</p>
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

## 實戰三：產品卡片裁切

電商產品展示中常見的不規則卡片：

```html
<div class="product-grid">
  <div class="product-card">
    <div class="product-image">
      <img src="product1.jpg" alt="產品1" />
    </div>
    <div class="product-info">
      <h3>產品名稱</h3>
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

  /* 底部斜切效果，讓圖片和下方內容形成流暢過渡 */
  clip-path: polygon(0% 0%, 100% 0%, 100% 85%, 0% 100%);
}

.product-info {
  padding: 16px 20px;
  margin-top: -20px; /* 拉近與圖片的距離 */
}

.price {
  color: #e74c3c;
  font-size: 24px;
  font-weight: bold;
}
```

## 動畫過渡

`clip-path` 支持 CSS transition 和 animation，前提是**形狀函數相同且頂點數量一致**：

```css
/* 動畫效果：懸停時從圓形展開為方形 */
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
/* 多邊形之間的過渡也可以工作 */
.shape-morph {
  background: linear-gradient(45deg, #f093fb, #f5576c);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  transition: clip-path 0.5s ease;
}

.shape-morph:hover {
  clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
}
```

**踩過的坑：** 從 `circle()` 過渡到 `polygon()` 是不行的，因為兩種形狀函數無法插值。必須保持函數類型一致：

```css
/* 錯誤：不能過渡 */
clip-path: circle(50%) → clip-path: polygon(...)

/* 正確：都是 circle */
clip-path: circle(10%) → clip-path: circle(75%)
```

## 關鍵幀動畫

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

這個效果是從左到右展開顯示，適合頁面元素的入場動畫。

## 實戰四：文字沿形狀排列

雖然 `clip-path` 本身不控制文字排列，但配合 `shape-outside` 可以實現文字環繞不規則形狀：

```css
.float-shape {
  width: 200px;
  height: 200px;
  float: left;
  background: #1890ff;

  /* 視覺裁切 */
  clip-path: circle(50%);

  /* 文字環繞的形狀（需要和 clip-path 一致） */
  shape-outside: circle(50%);
}
```

```html
<div class="article">
  <div class="float-shape"></div>
  <p>這段文字會環繞在圓形元素的周圍，而不是簡單的矩形環繞。shape-outside
  定義了浮動元素周圍的環繞形狀，讓文字自然地貼合不規則的邊緣。</p>
</div>
```

## 兼容性

截至 2019 年中：

| 瀏覽器 | 支持情況 |
|
--------|----------|
| Chrome | 55+ (完整支持) |
| Firefox | 54+ (完整支持) |
| Safari | 9.1+ (需要 -webkit- 前綴) |
| Edge | 12+ (部分支持) |
| IE | 不支持 |

```css
/* 完整兼容寫法 */
.element {
  -webkit-clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
}

/* IE 降級 */
@supports not (clip-path: polygon(0% 0%)) {
  .element {
    /* 使用 overflow: hidden + border-radius 等傳統方案 */
  }
}
```

## 小結

- `clip-path` 支持 `inset()`、`circle()`、`ellipse()`、`polygon()`、`url()` 五種形狀函數
- `polygon()` 最強大，可以定義任意多邊形，用百分比或長度值指定頂點
- 支持 CSS transition 動畫，但要求形狀函數類型相同、頂點數量一致
- 配合 `shape-outside` 可以實現文字環繞不規則形狀
- Safari 需要 `-webkit-` 前綴，IE 完全不支持，需要降級方案
- 適合斜邊卡片、波浪背景、圖片裁切、入場動畫等場景
