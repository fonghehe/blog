---
title: "CSS Container Queries Proposal Deep Dive"
date: 2019-10-08 17:48:44
tags:
  - CSS
readingTime: 3
description: "In responsive design, we've always relied on `@media` queries to adapt layouts based on the viewport size. But this approach has a fundamental flaw: a component's behavior depends on the viewport rather than on the component's own size. The Container Queries proposal aims to fix this by letting components adjust their styles based on the size of their parent container."
wordCount: 339
---

In responsive design, we've always relied on `@media` queries to adapt layouts based on the viewport size. But this approach has a fundamental flaw: a component's behavior depends on the viewport rather than on the component's own size. The Container Queries proposal aims to fix this by letting components adjust their styles based on the size of their parent container.

## Pain Points of Responsive Design

Suppose you have a card component that should lay out horizontally in the main content area but stack vertically in a sidebar. Using `@media` queries:

```css
/* 只能根据视口宽度判断 */
@media (min-width: 768px) {
  .card {
    flex-direction: row;
  }
}

@media (max-width: 767px) {
  .card {
    flex-direction: column;
  }
}
```

The problem is that even when the viewport is wide, if the card lives in a narrow sidebar it should still render in its narrow-screen layout. `@media` queries can't handle this scenario.

## Container Queries Proposal Core Concepts

The core idea behind Container Queries (also known as Element Queries) is to let CSS query the size of a parent container instead of the viewport. The proposed syntax looks roughly like this:

```css
/* 声明一个查询容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 根据容器宽度调整样式 */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
  .card__image {
    width: 200px;
    flex-shrink: 0;
  }
  .card__content {
    padding: 24px;
  }
}

@container card (max-width: 399px) {
  .card {
    flex-direction: column;
  }
  .card__image {
    width: 100%;
    height: 160px;
    object-fit: cover;
  }
  .card__content {
    padding: 16px;
  }
}
```

## Proposal Syntax Details

### container-type

`container-type` declares an element as a query container and the dimension(s) that can be queried:

```css
/* 只查询 inline-size（水平方向宽度） */
.sidebar {
  container-type: inline-size;
}

/* 查询 size（宽度和高度） */
.panel {
  container-type: size;
}

/* 声明但不启用查询 */
.widget {
  container-type: normal;
}
```

### container-name

`container-name` gives a container a name so that queries can target it precisely:

```css
.main-content {
  container-type: inline-size;
  container-name: main;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* 精确查询 main 容器 */
@container main (min-width: 600px) {
  .card { /* ... */ }
}

/* 精确查询 sidebar 容器 */
@container sidebar (min-width: 300px) {
  .card { /* ... */ }
}
```

### `container` shorthand

```css
/* 等价于 container-type + container-name */
.widget-wrapper {
  container: widget / inline-size;
}
```

## Real-World Use Cases

### Scenario 1: Responsive Components in a Component Library

```css
.card-wrapper {
  container: card-layout / inline-size;
}

@container card-layout (min-width: 500px) {
  .card {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 24px;
  }
}

@container card-layout (min-width: 300px) and (max-width: 499px) {
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}

@container card-layout (max-width: 299px) {
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card__title {
    font-size: 14px;
  }
  .card__description {
    display: none;
  }
}
```

### Scenario 2: Dashboards

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.widget {
  container: widget / inline-size;
}

@container widget (min-width: 400px) {
  .widget__chart {
    height: 200px;
  }
  .widget__details {
    display: block;
  }
}

@container widget (max-width: 399px) {
  .widget__chart {
    height: 100px;
  }
  .widget__details {
    display: none;
  }
}
```

## Simulating with ResizeObserver

Until native support arrives, you can simulate this with JavaScript + ResizeObserver:

```js
class ContainerQuery {
  constructor(element, breakpoints) {
    this.element = element;
    this.breakpoints = breakpoints;
    this.observer = new ResizeObserver(this.handleResize.bind(this));
    this.observer.observe(element);
  }

  handleResize(entries) {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      this.applyClasses(width);
    }
  }

  applyClasses(width) {
    Object.keys(this.breakpoints).forEach(bp => {
      this.element.classList.remove(`cq-${bp}`);
    });

    let matched = null;
    const sorted = Object.entries(this.breakpoints)
      .sort((a, b) => a[1] - b[1]);

    for (const [name, minWidth] of sorted) {
      if (width >= minWidth) matched = name;
    }

    if (matched) this.element.classList.add(`cq-${matched}`);
  }

  destroy() {
    this.observer.disconnect();
  }
}

// 使用
const wrapper = document.querySelector('.card-wrapper');
new ContainerQuery(wrapper, { sm: 300, md: 500, lg: 700 });
```

## Wrapping as a React Hook

```jsx
import { useEffect, useRef, useState } from 'react';

function useContainerQuery(breakpoints) {
  const ref = useRef(null);
  const [breakpoint, setBreakpoint] = useState(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const sorted = Object.entries(breakpoints)
          .sort((a, b) => b[1] - a[1]);

        let matched = null;
        for (const [name, minWidth] of sorted) {
          if (width >= minWidth) {
            matched = name;
            break;
          }
        }
        setBreakpoint(matched);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, breakpoint];
}

// 使用
function Card() {
  const [ref, bp] = useContainerQuery({
    small: 0,
    medium: 300,
    large: 500,
  });

  return (
    <div ref={ref}>
      <div className={`card card--${bp}`}>
        <img className="card__image" src="photo.jpg" alt="" />
        <div className="card__content">
          <h3>卡片标题</h3>
          <p>卡片描述内容</p>
        </div>
      </div>
    </div>
  );
}
```

## Container Queries vs @media

The two are complementary, not substitutes for each other:

- **@media**: best for global layout decisions (page-level responsiveness)
- **@container**: best for component-level responsiveness (a component adapts to its own context)

```css
/* 全局布局用 @media */
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

/* 组件自适应用 @container */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

## Summary

- Container Queries let components adjust their styles based on the size of their parent container
- Core syntax of the proposal: `container-type`, `container-name`, `@container`
- Solves the pain point of making component libraries adapt across different layout contexts
- As of 2019 it is still a proposal, with no native browser support yet
- Can be emulated with a ResizeObserver + CSS class-name approach
- A React Hook wrapper can simplify usage inside components
- Container Queries and `@media` queries are complementary
