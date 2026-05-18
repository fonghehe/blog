---
title: "CSS Container Queries 瀏覽器支持在即"
date: 2021-08-23 09:48:53
tags:
  - CSS
readingTime: 2
description: "關注 CSS 規範的同學可能已經注意到了，Container Queries 已經進入 Chrome Canary 實驗階段。這個特性等了好幾年，終於要來了。"
---

關注 CSS 規範的同學可能已經注意到了，Container Queries 已經進入 Chrome Canary 實驗階段。這個特性等了好幾年，終於要來了。

## 什麼是 Container Queries

Media Queries 根據**視口寬度**響應，Container Queries 根據**父容器寬度**響應。

這才是組件化開發真正需要的能力。

```css
/* Media Queries：根據瀏覽器窗口寬度 */
@media (min-width: 768px) {
  .card { flex-direction: row; }
}

/* Container Queries：根據父容器寬度 */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## 為什麼這個特性很重要

現在的痛點：同一個組件放在側邊欄（窄）和主內容區（寬），表現應該不同。但 Media Queries 只看視口，不看容器。

```html
<!-- 同一個 Card 組件 -->
<div class="sidebar">
  <Card /> <!-- 側邊欄窄，應該顯示緊湊佈局 -->
</div>

<main>
  <Card /> <!-- 主內容區寬，應該顯示完整佈局 -->
</main>

<!-- 兩個 Card 在同一個視口下，Media Queries 無法區分 -->
```

## 語法詳解

```css
/* 1. 定義容器 */
.card-container {
  container-type: inline-size;  /* 只監控 inline 方向（水平）的尺寸 */
  container-name: card;          /* 可選：給容器命名 */
}

/* 簡寫 */
.card-container {
  container: card / inline-size;
}

/* 2. 使用 @container 查詢 */
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

## 實際案例：響應式卡片

```css
.card-wrapper {
  container: card / inline-size;
}

/* 窄容器：垂直堆疊 */
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

/* 寬容器：更大的佈局 */
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

## 和現有方案對比

```javascript
// 現在的常見做法：用 ResizeObserver 監控容器寬度
// 不優雅，而且有性能開銷

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

// Container Queries 一行 CSS 搞定，瀏覽器原生優化
```

## 配合 Tailwind CSS

Tailwind 3.0 已經實驗性支持 `@container`：

```html
<!-- 需要在容器上加 container 類 -->
<div class="@container">
  <div class="flex @md:flex-row @lg:gap-8">
    <img class="w-full @md:w-32 @lg:w-48" />
    <div class="@md:ml-4">
      <h3 class="text-sm @md:text-lg @lg:text-xl">標題</h3>
    </div>
  </div>
</div>
```

## 瀏覽器支持現狀

截至 2021 年 8 月：

- Chrome Canary：實驗性支持（需要開啓 flag）
- Chrome 105+：預計默認支持
- Firefox / Safari：暫無支持時間表

目前可以用 PostCSS 插件做降級：

```bash
npm install -D @csstools/postcss-container-queries
```

## 小結

- Container Queries 讓組件根據父容器寬度響應，解決了 Media Queries 的根本侷限
- 語法：`container-type` 定義容器，`@container` 查詢
- 組件化開發的必備能力，Grid + Container Queries = 真正的響應式組件
- 瀏覽器支持還在早期，但趨勢已定，值得提前瞭解