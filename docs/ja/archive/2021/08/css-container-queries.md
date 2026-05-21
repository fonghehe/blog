---
title: "CSS Container Queries：ブラウザサポートが間近"
date: 2021-08-23 09:48:53
tags:
  - CSS

readingTime: 2
description: "关注 CSS 规范的同学可能已经注意到了，Container Queries 已经进入 Chrome Canary 实验阶段。这个特性等了好几年，终于要来了。"
wordCount: 330
---

关注 CSS 规范的同学可能已经注意到了，Container Queries 已经进入 Chrome Canary 实验阶段。这个特性等了好几年，终于要来了。

## Container Queries とは

Media Queries 根据**视口宽度**响应，Container Queries 根据**父容器宽度**响应。

这才是组件化开发真正需要的能力。

```css
/* Media Queries：根据浏览器窗口宽度 */
@media (min-width: 768px) {
  .card { flex-direction: row; }
}

/* Container Queries：根据父容器宽度 */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## なぜこの機能が重要か

现在的痛点：同一个组件放在侧边栏（窄）和主内容区（宽），表现应该不同。但 Media Queries 只看视口，不看容器。

```html
<!-- 同一个 Card 组件 -->
<div class="sidebar">
  <Card /> <!-- 侧边栏窄，应该显示紧凑布局 -->
</div>

<main>
  <Card /> <!-- 主内容区宽，应该显示完整布局 -->
</main>

<!-- 两个 Card 在同一个视口下，Media Queries 无法区分 -->
```

## 構文の詳細

```css
/* 1. 定义容器 */
.card-container {
  container-type: inline-size;  /* 只监控 inline 方向（水平）的尺寸 */
  container-name: card;          /* 可选：给容器命名 */
}

/* 简写 */
.card-container {
  container: card / inline-size;
}

/* 2. 使用 @container 查询 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .card__image {
    aspect-ratio: 1;
  }
}

@container card (min-width: 600px) {
  .card {
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }
}
```

## 実際の事例：レスポンシブカード

```css
.card-wrapper {
  container: card / inline-size;
}

/* 窄容器：垂直堆叠 */
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card__title {
  font-size: 1rem;
}

/* 中等容器：水平排列 */
@container card (min-width: 350px) {
  .card {
    flex-direction: row;
    align-items: center;
  }

  .card__image {
    width: 120px;
    flex-shrink: 0;
  }

  .card__title {
    font-size: 1.125rem;
  }
}

/* 宽容器：更大的布局 */
@container card (min-width: 500px) {
  .card {
    gap: 1.5rem;
  }

  .card__image {
    width: 200px;
  }

  .card__title {
    font-size: 1.25rem;
  }
}
```

## 既存ソリューションとの比較

```javascript
// 现在的常见做法：用 ResizeObserver 监控容器宽度
// 不优雅，而且有性能开销

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = entry.contentRect.width
    entry.target.classList.toggle('compact', width < 400)
    entry.target.classList.toggle('normal', width >= 400 && width < 600)
    entry.target.classList.toggle('wide', width >= 600)
  }
})

document.querySelectorAll('.card-wrapper').forEach((el) => {
  observer.observe(el)
})

// Container Queries 一行 CSS 搞定，浏览器原生优化
```

## Tailwind CSS との組み合わせ

Tailwind 3.0 已经实验性支持 `@container`：

```html
<!-- 需要在容器上加 container 类 -->
<div class="@container">
  <div class="flex @md:flex-row @lg:gap-8">
    <img class="w-full @md:w-32 @lg:w-48" />
    <div class="@md:ml-4">
      <h3 class="text-sm @md:text-lg @lg:text-xl">标题</h3>
    </div>
  </div>
</div>
```

## ブラウザサポートの現状

截至 2021 年 8 月：

- Chrome Canary：实验性支持（需要开启 flag）
- Chrome 105+：预计默认支持
- Firefox / Safari：暂无支持时间表

目前可以用 PostCSS 插件做降级：

```bash
npm install -D @csstools/postcss-container-queries
```

## まとめ

- Container Queries 让组件根据父容器宽度响应，解决了 Media Queries 的根本局限
- 语法：`container-type` 定义容器，`@container` 查询
- 组件化开发的必备能力，Grid + Container Queries = 真正的响应式组件
- 浏览器支持还在早期，但趋势已定，值得提前了解