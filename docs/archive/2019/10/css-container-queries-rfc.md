---
title: "CSS Container Queries 提案解读"
date: 2019-10-08 17:48:44
tags:
  - CSS
readingTime: 3
description: "在响应式设计中，我们一直依赖 `@media` 查询根据视口（viewport）大小来调整布局。但这种方式有一个根本性的缺陷：组件的行为取决于视口，而不是组件自身的尺寸。Container Queries 提案试图解决这个问题，让组件可以根据其父容器的尺寸来调整自身样式。"
wordCount: 514
---

在响应式设计中，我们一直依赖 `@media` 查询根据视口（viewport）大小来调整布局。但这种方式有一个根本性的缺陷：组件的行为取决于视口，而不是组件自身的尺寸。Container Queries 提案试图解决这个问题，让组件可以根据其父容器的尺寸来调整自身样式。

## 响应式设计的痛点

假设你有一个卡片组件，在主内容区它应该横向排列，在侧边栏它应该纵向排列。使用 `@media` 查询：

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

问题在于：即使视口很宽，如果卡片被放在窄的侧边栏里，它仍然应该以窄屏模式展示。`@media` 查询无法处理这种场景。

## Container Queries 提案核心概念

Container Queries（也称为 Element Queries）的核心思想是让 CSS 可以查询父容器的尺寸，而不是视口的尺寸。提案中的语法大致如下：

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

## 提案语法详解

### container-type

`container-type` 定义一个元素作为查询容器，以及它可以被查询的维度：

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

`container-name` 给容器命名，这样查询可以精确指向特定容器：

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

### container 简写

```css
/* 等价于 container-type + container-name */
.widget-wrapper {
  container: widget / inline-size;
}
```

## 实际应用场景

### 场景一：组件库中的响应式组件

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

### 场景二：Dashboard 仪表盘

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

## 用 ResizeObserver 模拟

在原生支持到来之前，可以用 JavaScript + ResizeObserver 模拟：

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

## 封装成 React Hook

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

## Container Queries 与 @media 的关系

两者是互补关系，不是替代关系：

- **@media**：适用于全局布局决策（页面级响应式）
- **@container**：适用于组件级响应式（组件自适应）

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

## 小结

- Container Queries 让组件可以根据父容器尺寸调整样式
- 提案核心语法：`container-type`、`container-name`、`@container`
- 解决了组件库在不同布局上下文中自适应的痛点
- 截至 2019 年仍处于提案阶段，尚无浏览器原生支持
- 可用 ResizeObserver + CSS 类名方式模拟实现
- React Hook 封装可以简化组件中的使用
- Container Queries 与 @media 查询是互补关系
