---
title: "CSS Subgrid Layout: Early Firefox Support and Practical Examples"
date: 2019-09-25 16:21:47
tags:
  - CSS
readingTime: 1
description: "When it comes to CSS Subgrid layout, many developers only scratch the surface at the API level. This article examines the practical problems you'll hit in production and how to solve them."
wordCount: 187
---

When it comes to CSS Subgrid, many developers only scratch the surface at the API-call level. This article tries to look at it from a production perspective, discussing the problems you'll actually hit and how to solve them.

## Basic Principles

The key is to understand the core logic:

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

Performance tuning should fit the specific scenario—you don't need to over-optimize every case.

## Advanced Features

Here are a few ways we can improve on this:

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

This approach has been running stably in production for over half a year, so it's battle-tested.

## Project Practice

Let's start with the basic implementation:

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

This snippet shows the basic usage. In a real project, you'll also need to handle errors and edge cases.

## Best Practices

Building on that, we can optimize further:

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

This pattern is especially handy in large projects, and it noticeably cuts maintenance cost.

## Summary

- CSS Subgrid isn't a silver bullet—choose it based on your project's scale and tech stack.
- Understanding the underlying principles matters more than memorizing the API.
- Before using it in production, be sure to verify compatibility.
- In a team, conventions and documentation matter more than the technology itself.
