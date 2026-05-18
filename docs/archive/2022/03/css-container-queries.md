---
title: "CSS Container Queries：响应式设计的下一个里程碑"
date: 2022-03-22 09:48:38
tags:
  - CSS
readingTime: 2
description: "等了好几年，CSS Container Queries 终于在主流浏览器落地了。传统媒体查询基于视口宽度，但组件化开发需要的是基于容器宽度的响应式。这才是组件真正需要的能力。"
---

等了好几年，CSS Container Queries 终于在主流浏览器落地了。传统媒体查询基于视口宽度，但组件化开发需要的是基于容器宽度的响应式。这才是组件真正需要的能力。

## 为什么需要 Container Queries

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

以前用媒体查询，只能根据浏览器视口来决定样式——但这里的卡片组件需要根据父容器宽度来决定布局。

## 基本用法

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

`container-type: inline-size` 告诉浏览器：这个元素是一个容器，需要监控它的行内方向（水平）尺寸变化。

## 容器查询单位

和视口单位类似，Container Queries 也引入了容器相对单位：

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

## 组件库中的实际应用

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

## Container Name 的作用

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

## 与 CSS 变量结合

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

## 浏览器支持（2022 年中）

Chrome 105+、Edge 105+、Safari 16+、Firefox 110+。对于不支持的浏览器，可以用 PostCSS 插件降级：

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

## 小结

Container Queries 解决了组件化开发中最基本的需求：让组件根据自己的容器响应式调整布局，而不是依赖全局视口。这是 CSS 响应式设计从「页面级」到「组件级」的进化。现在主流浏览器都已支持，是时候在组件库中用起来了。