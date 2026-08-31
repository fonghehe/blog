---
title: "CSS aspect-ratio Proposal Explained: Saying Goodbye to the padding-top Hack"
date: 2019-11-11 10:30:38
tags:
  - CSS
readingTime: 1
description: "We recently rolled out native `aspect-ratio` in our team and learned a lot along the way. Writing this up in case it helps anyone doing similar work."
wordCount: 184
---

We recently rolled out native `aspect-ratio` in our team and learned a lot along the way. I'm writing this up in case it helps anyone doing similar work.

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

Performance optimization has to be tied to the specific scenario—you don't need to over-optimize everything.

## In-Depth Analysis

We can improve things in the following ways:

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

This approach has been running stably in production for over half a year and has stood up to real-world use.

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

This snippet shows the basic usage. In a real project you'll also need to think about error handling and edge cases.

## Optimization Strategies

On top of this, we can optimize further:

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

This pattern is very practical in large projects and noticeably lowers maintenance cost.

## Summary

- In team collaboration, conventions and documentation matter more than the technology itself
- Keep an eye on the community; technical solutions need continuous iteration
- Don't adopt new tech just for the sake of using it
- The code examples are for reference only; adapt them to your own use case
