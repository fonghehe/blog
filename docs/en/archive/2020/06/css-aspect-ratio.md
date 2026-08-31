---
title: "Native CSS aspect-ratio: Chrome 88 Official Support"
date: 2019-11-11 10:30:38
tags:
  - CSS
readingTime: 1
description: "We recently adopted native CSS aspect-ratio on our team and gained valuable experience. I'm writing this up as a reference for anyone doing similar work."
wordCount: 180
---

We recently adopted native CSS aspect-ratio in our team and learned a lot in the process. I'm writing this up as a reference, hoping it helps others who are doing similar work.

## Core Concepts

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

## In-Depth Analysis

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

## Implementation Experience

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

## Tuning Strategy

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

- In a team, conventions and documentation matter more than the technology itself.
- Keep an eye on the community—your technical approach needs to keep iterating.
- Don't adopt new tech just for its own sake.
- The code examples are for reference only—adapt them to your own use case.
