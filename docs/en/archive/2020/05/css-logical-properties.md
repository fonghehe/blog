---
title: "CSS Logical Properties: Browser Support and Production Practice"
date: 2019-09-09 15:05:57
tags:
  - CSS
readingTime: 2
description: "In day-to-day development, CSS Logical Properties are used more and more frequently. This article systematically covers their usage, underlying principles, and optimization strategies."
wordCount: 179
---

In day-to-day development, CSS Logical Properties are being used more and more often. This article systematically covers their usage, the underlying principles, and optimization strategies.

## Quick Start

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

Pay close attention to edge-case handling—this is critical in production.

## Internal Principles

The key is understanding the core logic:

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

Performance optimization needs to fit the actual use case; not every situation calls for over-optimization.

## Business Practice

We can improve on this in the following ways:

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

This approach has been running stably in production for over half a year and has proven itself in practice.

## Performance Comparison

Let's first look at the basic implementation:

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

This snippet shows the basic usage. In a real project you'd also need to account for error handling and edge cases.

## Troubleshooting

Building on this, we can optimize further:

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

This pattern is very practical in large projects and can significantly reduce maintenance cost.

## Summary

- Understanding the underlying principles matters more than memorizing the API.
- Always verify compatibility before using it in production.
- In team collaboration, conventions and documentation matter more than the technology itself.
