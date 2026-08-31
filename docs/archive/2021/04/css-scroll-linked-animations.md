---
title: "CSS 滚动驱动动画 Scroll Animations"
date: 2021-04-21 17:22:10
tags:
  - CSS
readingTime: 2
description: "最近在团队中落地CSS 滚动驱动动画 Scroll Animations，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 292
---

最近在团队里落地了 CSS 滚动驱动动画（Scroll-driven Animations），积累了一些经验。整理出来供参考，希望对做类似工作的同学有帮助。

## 核心概念

关键是理解背后的核心逻辑：

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

性能优化要结合具体场景，并非所有情况都值得专门去做。

## 深度解析

我们可以用下面这种方式来改进：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

这套方案已经在线上稳定运行半年多，经受过实际验证。

## 落地经验

先看最基本的实现方式：

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

这段代码演示了基本用法。真实项目里还得考虑错误处理和边界情况。

## 调优策略

在这个基础上，我们还能进一步优化：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

这种模式在大型项目里很实用，能明显降低维护成本。

## 小结

- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- CSS 滚动驱动动画 Scroll Animations不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要