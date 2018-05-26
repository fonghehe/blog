---
title: "响应式设计实践：从移动优先开始"
date: 2018-05-26 11:18:01
tags:
  - CSS
---

做了好几个移动端项目，总结一下响应式设计的实践经验。

## 移动优先（Mobile First）

先写移动端样式，然后用 `min-width` 媒体查询逐步扩展到大屏：

```css
/* ✅ 移动优先 */
.container {
  padding: 16px; /* 默认：手机 */
}

@media (min-width: 768px) {
  .container {
    padding: 24px; /* 平板 */
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px; /* 桌面 */
  }
}

/* ❌ 桌面优先（不推荐，移动端要覆盖太多东西）*/
.container {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .container {
    max-width: 100%;
    padding: 16px;
  }
}
```

## 断点规划

```css
/* 常见断点（和主流设备对齐）*/
/* 手机：< 576px（默认，不需要媒体查询）*/
/* 大手机/小平板：≥ 576px */
/* 平板：≥ 768px */
/* 小桌面：≥ 992px */
/* 大桌面：≥ 1200px */

:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
}
```

## Flexbox 响应式

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  /* 手机：一行一个 */
  flex: 1 1 100%;
}

@media (min-width: 576px) {
  .card {
    /* 平板：一行两个 */
    flex: 1 1 calc(50% - 8px);
  }
}

@media (min-width: 992px) {
  .card {
    /* 桌面：一行三个 */
    flex: 1 1 calc(33.333% - 11px);
  }
}
```

## Grid 响应式（更推荐）

```css
.card-list {
  display: grid;
  /* 自动响应，不需要媒体查询 */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

## 图片响应式

```html
<!-- srcset：根据 DPR 选择图片 -->
<img src="image.jpg" srcset="image.jpg 1x, image@2x.jpg 2x" alt="图片" />

<!-- sizes + srcset：根据视口宽度选择图片 -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, 33vw"
  alt="图片"
/>

<!-- picture：不同设备不同图片 -->
<picture>
  <source media="(max-width: 576px)" srcset="mobile.jpg" />
  <source media="(max-width: 992px)" srcset="tablet.jpg" />
  <img src="desktop.jpg" alt="图片" />
</picture>
```

## 字体响应式

```css
/* 传统方式：媒体查询 */
h1 {
  font-size: 24px;
}
@media (min-width: 768px) {
  h1 {
    font-size: 32px;
  }
}
@media (min-width: 1200px) {
  h1 {
    font-size: 48px;
  }
}

/* 现代方式：clamp()（响应式且流畅）*/
h1 {
  /* 最小 24px，最大 48px，中间线性插值 */
  font-size: clamp(24px, 4vw, 48px);
}
```

## 测试响应式

```
1. Chrome DevTools：手机模拟器，选各种设备尺寸
2. 实际设备测试：尤其是 iOS Safari（和 Chrome 渲染差异大）
3. 测试断点临界值（767px、768px）
4. 测试横屏状态
```

## 小结

- 移动优先：从小屏开始写，用 `min-width` 扩展
- 断点选 576/768/992/1200（和主流框架对齐）
- Grid 的 `auto-fill + minmax` 比 Flex 更省媒体查询
- 图片用 `srcset`，字体用 `clamp()`
- 必须在真实设备上测试 iOS Safari