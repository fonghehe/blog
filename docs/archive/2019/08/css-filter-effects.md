---
title: "CSS filter 滤镜效果实战"
date: 2019-08-28 10:01:02
tags:
  - CSS
---

CSS `filter` 属性让我们可以在不修改图片素材的情况下，对元素应用各种视觉效果：模糊、灰度、对比度调整、阴影等。这个属性在图片处理、UI 动效、暗黑模式适配等场景中非常实用。本文将详细讲解每个 filter 函数的用法，并通过实际案例展示如何组合使用。

## filter 基础语法

```css
.element {
  filter: <function>(<value>);
  /* 多个滤镜可以叠加 */
  filter: blur(5px) brightness(1.2) contrast(0.8);
}
```

## 各滤镜函数详解

### blur — 高斯模糊

```css
/* 值为长度单位，值越大越模糊 */
.card-bg {
  filter: blur(20px);
}

/* 常见的毛玻璃效果 */
.frosted-glass {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);  /* 注意：backdrop-filter 是另一个属性 */
  -webkit-backdrop-filter: blur(10px);
}
```

### brightness — 亮度

```css
/* 0 = 全黑, 1 = 原始, >1 = 更亮 */
.hover-bright:hover {
  filter: brightness(1.2);
}

/* 变暗 */
.dim {
  filter: brightness(0.6);
}
```

### contrast — 对比度

```css
/* 1 = 原始, <1 降低对比度, >1 增加对比度 */
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

/* 哀悼日全站变灰 */
body.mourning {
  filter: grayscale(1);
}

/* hover 时恢复彩色 */
.gallery-item {
  filter: grayscale(0.8);
  transition: filter 0.3s;
}
.gallery-item:hover {
  filter: grayscale(0);
}
```

### sepia — 复古色调

```css
/* 0 = 原始, 1 = 完全复古 */
.vintage-photo {
  filter: sepia(0.8);
}
```

### saturate — 饱和度

```css
/* 0 = 无饱和（灰度）, 1 = 原始, >1 = 过饱和 */
.vibrant {
  filter: saturate(1.5);
}

.muted {
  filter: saturate(0.5);
}
```

### hue-rotate — 色相旋转

```css
/* 值为角度，旋转色相 */
.color-shift {
  filter: hue-rotate(90deg);
}

/* 动态色彩变换动画 */
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

/* 反色常用于快速实现暗黑模式 */
.quick-dark-mode {
  filter: invert(1) hue-rotate(180deg);
}
/* hue-rotate(180deg) 把反色后的颜色再转回来，避免照片看起来奇怪 */
```

### opacity — 透明度

```css
/* 与 CSS opacity 类似，但可以与其他 filter 组合 */
.transparent {
  filter: opacity(0.5);
}

/* 与对比度组合 */
.muted-card {
  filter: opacity(0.8) contrast(0.9);
}
```

### drop-shadow — 投影

```css
/* 类似 box-shadow，但可以应用于不规则形状 */
.icon-shadow {
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3));
}

/* drop-shadow 对透明 PNG 图片有效 */
.png-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* box-shadow 只作用于元素的矩形边界 */
/* drop-shadow 根据元素实际内容（alpha 通道）投影 */
```

## 实战案例

### 案例一：图片加载过渡效果

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
// 或使用 IntersectionObserver 懒加载
```

### 案例二：模态框背景模糊

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
  /* modal 内容不模糊 */
}
```

### 案例三：悬停滤镜效果

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

### 案例四：禁用状态样式

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

### 案例五：CSS 变量控制滤镜强度

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
// 通过 JS 动态调整
document.documentElement.style.setProperty('--blur-amount', '5px');
document.documentElement.style.setProperty('--grayscale-amount', '0.5');
```

### 案例六：暗黑模式快速适配

```css
/* 简单粗暴但有效的方法 */
@media (prefers-color-scheme: dark) {
  html {
    filter: invert(1) hue-rotate(180deg);
  }

  /* 图片和视频恢复原色 */
  img, video, canvas {
    filter: invert(1) hue-rotate(180deg);
  }
}
```

这种方法适用于快速原型或过渡期，生产环境建议还是使用 CSS 变量和主题色方案。

## filter 动画与性能

### 使用 GPU 加速

filter 动画默认会触发 GPU 加速，但 `blur` 动画开销较大：

```css
/* 推荐的动画属性 */
.smooth-transition {
  transition: filter 0.3s ease;
}

/* 避免对 blur 做频繁动画 */
/* 如果必须，尽量减小模糊半径 */
.expensive-blur {
  filter: blur(50px); /* 50px 的 blur 动画很耗性能 */
}

.cheap-blur {
  filter: blur(3px); /* 小半径的 blur 性能影响较小 */
}
```

### 性能对比

```css
/* 性能开销从小到大 */
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

`backdrop-filter` 的浏览器支持情况（2019 年）：

- Chrome 76+ — 支持（需要开启 flag 或使用 `-webkit-` 前缀）
- Firefox 70+ — 支持
- Safari 9+ — 支持 `-webkit-backdrop-filter`
- Edge — 需要 `-webkit-` 前缀
- IE — 不支持

```css
/* 渐进增强 */
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

## 小结

- CSS `filter` 提供了 blur、brightness、contrast、grayscale、sepia、saturate、hue-rotate、invert、opacity、drop-shadow 共 10 个滤镜函数
- 多个滤镜可以组合使用，按声明顺序叠加效果
- `backdrop-filter` 可以对元素背后的内容应用滤镜，实现毛玻璃效果
- filter 动画性能开销从小到大：opacity < grayscale < brightness < contrast < drop-shadow < blur
- 使用 CSS 变量可以实现动态滤镜效果的精确控制
- `drop-shadow` 与 `box-shadow` 不同，它根据元素实际内容（alpha 通道）投射阴影
- `backdrop-filter` 兼容性需要注意，建议使用 `@supports` 做渐进增强
