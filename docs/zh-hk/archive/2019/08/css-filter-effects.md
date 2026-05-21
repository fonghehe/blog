---
title: "CSS filter 濾鏡效果實戰"
date: 2019-08-28 10:01:02
tags:
  - CSS
readingTime: 3
description: "CSS `filter` 屬性讓我們可以在不修改圖片素材的情況下，對元素應用各種視覺效果：模糊、灰度、對比度調整、陰影等。這個屬性在圖片處理、UI 動效、暗黑模式適配等場景中非常實用。本文將詳細講解每個 filter 函數的用法，並通過實際案例展示如何組合使用。"
wordCount: 504
---

CSS `filter` 屬性讓我們可以在不修改圖片素材的情況下，對元素應用各種視覺效果：模糊、灰度、對比度調整、陰影等。這個屬性在圖片處理、UI 動效、暗黑模式適配等場景中非常實用。本文將詳細講解每個 filter 函數的用法，並通過實際案例展示如何組合使用。

## filter 基礎語法

```css
.element {
  filter: <function>(<value>);
  /* 多個濾鏡可以疊加 */
  filter: blur(5px) brightness(1.2) contrast(0.8);
}
```

## 各濾鏡函數詳解

### blur — 高斯模糊

```css
/* 值為長度單位，值越大越模糊 */
.card-bg {
  filter: blur(20px);
}

/* 常見的毛玻璃效果 */
.frosted-glass {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);  /* 注意：backdrop-filter 是另一個屬性 */
  -webkit-backdrop-filter: blur(10px);
}
```

### brightness — 亮度

```css
/* 0 = 全黑, 1 = 原始, >1 = 更亮 */
.hover-bright:hover {
  filter: brightness(1.2);
}

/* 變暗 */
.dim {
  filter: brightness(0.6);
}
```

### contrast — 對比度

```css
/* 1 = 原始, <1 降低對比度, >1 增加對比度 */
.high-contrast {
  filter: contrast(1.5);
}

.low-contrast {
  filter: contrast(0.5);
}
```

### grayscale — 灰度

```css
/* 0 = 彩色, 1 = 完全灰度 */
.grayscale {
  filter: grayscale(1);
}

/* 哀悼日全站變灰 */
body.mourning {
  filter: grayscale(1);
}

/* hover 時恢復彩色 */
.gallery-item {
  filter: grayscale(0.8);
  transition: filter 0.3s;
}
.gallery-item:hover {
  filter: grayscale(0);
}
```

### sepia — 復古色調

```css
/* 0 = 原始, 1 = 完全復古 */
.vintage-photo {
  filter: sepia(0.8);
}
```

### saturate — 飽和度

```css
/* 0 = 無飽和（灰度）, 1 = 原始, >1 = 過飽和 */
.vibrant {
  filter: saturate(1.5);
}

.muted {
  filter: saturate(0.5);
}
```

### hue-rotate — 色相旋轉

```css
/* 值為角度，旋轉色相 */
.color-shift {
  filter: hue-rotate(90deg);
}

/* 動態色彩變換動畫 */
@keyframes rainbow {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

.rainbow-effect {
  animation: rainbow 3s linear infinite;
}
```

### invert — 反色

```css
/* 0 = 原始, 1 = 完全反色 */
.inverted {
  filter: invert(1);
}

/* 反色常用於快速實現暗黑模式 */
.quick-dark-mode {
  filter: invert(1) hue-rotate(180deg);
}
/* hue-rotate(180deg) 把反色後的顏色再轉回來，避免照片看起來奇怪 */
```

### opacity — 透明度

```css
/* 與 CSS opacity 類似，但可以與其他 filter 組合 */
.transparent {
  filter: opacity(0.5);
}

/* 與對比度組合 */
.muted-card {
  filter: opacity(0.8) contrast(0.9);
}
```

### drop-shadow — 投影

```css
/* 類似 box-shadow，但可以應用於不規則形狀 */
.icon-shadow {
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3));
}

/* drop-shadow 對透明 PNG 圖片有效 */
.png-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* box-shadow 只作用於元素的矩形邊界 */
/* drop-shadow 根據元素實際內容（alpha 通道）投影 */
```

## 實戰案例

### 案例一：圖片加載過渡效果

```html
<div class="image-wrapper">
  <img src="photo.jpg" alt="照片" class="lazy-image" />
</div>
```

```css
.lazy-image {
  filter: blur(10px) brightness(1.1);
  transition: filter 0.5s ease-out;
}

.lazy-image.loaded {
  filter: blur(0) brightness(1);
}
```

```js
const img = document.querySelector('.lazy-image');
img.onload = () => img.classList.add('loaded');
// 或使用 IntersectionObserver 懶加載
```

### 案例二：模態框背景模糊

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
}

.modal {
  position: relative;
  z-index: 1001;
  /* modal 內容不模糊 */
}
```

### 案例三：懸停濾鏡效果

```css
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.photo-card {
  overflow: hidden;
  border-radius: 8px;
}

.photo-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.5) brightness(0.9);
  transition: filter 0.3s, transform 0.3s;
}

.photo-card:hover img {
  filter: grayscale(0) brightness(1) saturate(1.2);
  transform: scale(1.05);
}
```

### 案例四：禁用狀態樣式

```css
.button {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: filter 0.2s;
}

.button:hover {
  filter: brightness(1.1);
}

.button:active {
  filter: brightness(0.9);
}

.button:disabled {
  filter: grayscale(1) opacity(0.6);
  cursor: not-allowed;
}
```

### 案例五：CSS 變量控制濾鏡強度

```css
:root {
  --blur-amount: 0px;
  --brightness-amount: 1;
  --grayscale-amount: 0;
}

.dynamic-filter {
  filter:
    blur(var(--blur-amount))
    brightness(var(--brightness-amount))
    grayscale(var(--grayscale-amount));
}
```

```js
// 通過 JS 動態調整
document.documentElement.style.setProperty('--blur-amount', '5px');
document.documentElement.style.setProperty('--grayscale-amount', '0.5');
```

### 案例六：暗黑模式快速適配

```css
/* 簡單粗暴但有效的方法 */
@media (prefers-color-scheme: dark) {
  html {
    filter: invert(1) hue-rotate(180deg);
  }

  /* 圖片和視頻恢復原色 */
  img, video, canvas {
    filter: invert(1) hue-rotate(180deg);
  }
}
```

這種方法適用於快速原型或過渡期，生產環境建議還是使用 CSS 變量和主題色方案。

## filter 動畫與性能

### 使用 GPU 加速

filter 動畫默認會觸發 GPU 加速，但 `blur` 動畫開銷較大：

```css
/* 推薦的動畫屬性 */
.smooth-transition {
  transition: filter 0.3s ease;
}

/* 避免對 blur 做頻繁動畫 */
/* 如果必須，儘量減小模糊半徑 */
.expensive-blur {
  filter: blur(50px); /* 50px 的 blur 動畫很耗性能 */
}

.cheap-blur {
  filter: blur(3px); /* 小半徑的 blur 性能影響較小 */
}
```

### 性能對比

```css
/* 性能開銷從小到大 */
filter: opacity(0.5);          /* 低 */
filter: grayscale(1);          /* 低 */
filter: brightness(1.2);      /* 低 */
filter: contrast(1.2);        /* 低 */
filter: saturate(1.5);        /* 中 */
filter: hue-rotate(90deg);    /* 中 */
filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3)); /* 中 */
filter: blur(20px);           /* 高 */
```

## backdrop-filter 兼容性

`backdrop-filter` 的瀏覽器支持情況（2019 年）：

- Chrome 76+ — 支持（需要開啓 flag 或使用 `-webkit-` 前綴）
- Firefox 70+ — 支持
- Safari 9+ — 支持 `-webkit-backdrop-filter`
- Edge — 需要 `-webkit-` 前綴
- IE — 不支持

```css
/* 漸進增強 */
.glass-effect {
  background: rgba(255, 255, 255, 0.8);
}

@supports (backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px)) {
  .glass-effect {
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}
```

## 小結

- CSS `filter` 提供了 blur、brightness、contrast、grayscale、sepia、saturate、hue-rotate、invert、opacity、drop-shadow 共 10 個濾鏡函數
- 多個濾鏡可以組合使用，按聲明順序疊加效果
- `backdrop-filter` 可以對元素背後的內容應用濾鏡，實現毛玻璃效果
- filter 動畫性能開銷從小到大：opacity < grayscale < brightness < contrast < drop-shadow < blur
- 使用 CSS 變量可以實現動態濾鏡效果的精確控制
- `drop-shadow` 與 `box-shadow` 不同，它根據元素實際內容（alpha 通道）投射陰影
- `backdrop-filter` 兼容性需要注意，建議使用 `@supports` 做漸進增強
