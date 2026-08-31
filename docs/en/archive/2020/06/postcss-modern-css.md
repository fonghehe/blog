---
title: "PostCSS: Modern CSS Workflow"
date: 2020-06-05 10:28:15
tags:
  - CSS
readingTime: 1
description: "An exploration of PostCSS and modern CSS workflows, analyzing core principles and best practices based on real project experience."
wordCount: 179
---

The PostCSS modern CSS workflow is being adopted more and more widely in frontend development. Drawing on real projects, this article digs into its core principles and best practices.

## Basic Usage

In a real project, the usage gets a bit more involved:

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

This way, the code becomes both more testable and more extensible.

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

Mind the edge-case handling—that's critical in production.

## Practical Cases

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

## Performance Optimization

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

## Summary

- Don't adopt new tech just for its own sake.
- The code examples are for reference only—adapt them to your own use case.
- The PostCSS modern CSS workflow isn't a silver bullet—pick it based on your project's scale and tech stack.
- Understanding the underlying principles matters more than memorizing the API.
- Before using it in production, be sure to verify compatibility.
