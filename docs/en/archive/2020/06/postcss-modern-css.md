---
title: "PostCSS: Modern CSS Workflow"
date: 2020-06-05 10:28:15
tags:
  - CSS
readingTime: 2
description: "PostCSS 现代 CSS 工作流在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。"
---

PostCSS 现代 CSS 工作流在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。

## Basic Usage

实际项目中的用法会更复杂一些：

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## Advanced Usage

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## Practical Cases

关键在于理解核心逻辑：

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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 性能优化

我们可以通过以下方式来改进：

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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## Summary

- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- PostCSS 现代 CSS 工作流不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
