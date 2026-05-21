---
title: "CSS Variable Theming Solution"
date: 2019-02-21 15:40:07
tags:
  - CSS
readingTime: 1
description: "There are many articles online about CSS variable theming, but most lack real-world experience. This article explores best practices from actual projects."
wordCount: 86
---

There are many articles online about CSS variable theming, but most lack real-world experience. This article explores best practices from actual projects.

## Basic Concepts

Here is a real-world example:

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: 'Alice', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Deep Dive

This can be achieved with the following approach:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Project Application

Refer to the following implementation:

```css
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme="dark"] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition:
    background 0.3s,
    color 0.3s;
}
```

This setup has been validated in production and runs reliably.
