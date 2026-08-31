---
title: "CSS Container Queries: The Next Milestone in Responsive Design"
date: 2022-03-22 09:48:38
tags:
  - CSS
readingTime: 2
description: "After years of waiting, CSS Container Queries have finally landed in mainstream browsers. Traditional media queries are based on viewport width, but component-based development needs responsiveness based on container width. This is the capability components truly need."
wordCount: 198
---

After years of waiting, CSS Container Queries have finally landed in mainstream browsers. Traditional media queries are based on viewport width, but component-based development needs responsiveness based on container width. This is the capability components truly need.

## Why Container Queries

```html
<!-- 同一个卡片组件，在侧边栏和主内容区需要不同的样式 -->
<aside>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>标题</h3>
        <p>内容...</p>
      </div>
    </article>
  </div>
</aside>

<main>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>标题</h3>
        <p>内容...</p>
      </div>
    </article>
  </div>
</main>
```

With media queries, you could only decide styles based on the browser viewport — but here the card component needs to adjust its layout based on the parent container's width.

## Basic Usage

```css
/* 1. 定义容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 2. 使用 container query */
@container card (min-width: 400px) {
  .card {
    display: flex;
    gap: 16px;
  }

  .card img {
    width: 200px;
    height: 150px;
    object-fit: cover;
  }
}

@container card (min-width: 600px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .card img {
    width: 100%;
    height: 200px;
  }
}

/* 默认样式（小容器） */
.card {
  display: block;
}

.card img {
  width: 100%;
  height: auto;
}
```

`container-type: inline-size` tells the browser: this element is a container, and its inline (horizontal) size changes should be monitored.

## Container Query Units

Similar to viewport units, Container Queries introduce container-relative units:

```css
/* cqw = 容器宽度的 1% */
.card-title {
  font-size: clamp(14px, 3cqw, 24px);
}

/* cqh = 容器高度的 1% */
.hero-banner {
  height: clamp(200px, 50cqh, 400px);
}

/* cqi/cqbi = 行内方向 */
.sidebar-text {
  font-size: max(12px, 2.5cqi);
}
```

## Practical Use in Component Libraries

```css
/* Button 组件的响应式 */
.button-container {
  container-type: inline-size;
  container-name: button;
}

@container button (max-width: 200px) {
  .button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .button-icon {
    display: none;
  }
}

@container button (min-width: 400px) {
  .button {
    padding: 12px 24px;
    font-size: 16px;
  }

  .button-icon {
    margin-right: 8px;
  }
}
```

```css
/* 表单组件的响应式 */
.form-container {
  container-type: inline-size;
  container-name: form;
}

@container form (min-width: 500px) {
  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-row label {
    width: 120px;
    text-align: right;
  }
}

@container form (min-width: 800px) {
  .form-row {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    gap: 16px;
    align-items: center;
  }
}
```

## The Role of Container Name

```css
/* 页面有多种容器，用 container-name 区分 */
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

.main-content {
  container-type: inline-size;
  container-name: main;
}

/* 只响应侧边栏的尺寸变化 */
@container sidebar (min-width: 300px) { ... }

/* 只响应主内容区的尺寸变化 */
@container main (min-width: 800px) { ... }

/* 不指定名字的 query 会匹配最近的容器 */
@container (min-width: 400px) { ... }
```

## Combining with CSS Variables

```css
.card-container {
  container-type: inline-size;
  container-name: card;
  --card-gap: 12px;
  --card-direction: column;
}

@container card (min-width: 400px) {
  .card-container {
    --card-gap: 16px;
    --card-direction: row;
  }
}

@container card (min-width: 600px) {
  .card-container {
    --card-gap: 24px;
    --card-direction: row;
  }
}

.card {
  display: flex;
  flex-direction: var(--card-direction);
  gap: var(--card-gap);
}
```

## Browser Support (mid-2022)

Chrome 105+, Edge 105+, Safari 16+, Firefox 110+. For unsupported browsers, you can use a PostCSS plugin as a fallback:

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-preset-env')({
      features: {
        'css-container-queries': true,
      },
    }),
  ],
};
```

## Summary

Container Queries solve the most fundamental need in component-based development: letting components responsively adjust their layout based on their own container, rather than relying on the global viewport. This is the evolution of CSS responsive design from "page-level" to "component-level." All mainstream browsers now support it — it's time to start using it in your component libraries.