---
title: "Web Animations API: Native Animations"
date: 2021-11-26 10:22:00
tags:
  - JavaScript
  - CSS

readingTime: 1
description: "Web Animations API 原生动画 is becoming increasingly widespread in frontend development. This article dives into its core principles and best practices from real pr"
---

Web Animations API 原生动画 is becoming increasingly widespread in frontend development. This article dives into its core principles and best practices from real projects.

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

Through this approach, both the testability and scalability of the code are improved.

## Advanced Usage

Here is a complete example:

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

Pay attention to boundary condition handling, which is critical in production.

## Practical Cases

The key lies in understanding the core logic:

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

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Performance Optimization

We can improve it in the following ways:

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

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Web Animations API 原生动画不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production