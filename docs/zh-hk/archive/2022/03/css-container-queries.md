---
title: "CSS Container Queries：響應式設計的下一個里程碑"
date: 2022-03-22 09:48:38
tags:
  - CSS
readingTime: 2
description: "等了好幾年，CSS Container Queries 終於在主流瀏覽器落地了。傳統媒體查詢基於視口寬度，但組件化開發需要的是基於容器寬度的響應式。這才是組件真正需要的能力。"
wordCount: 319
---

等了好幾年，CSS Container Queries 終於在主流瀏覽器落地了。傳統媒體查詢基於視口寬度，但組件化開發需要的是基於容器寬度的響應式。這才是組件真正需要的能力。

## 為什麼需要 Container Queries

```html
<!-- 同一個卡片組件，在側邊欄和主內容區需要不同的樣式 -->
<aside>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>標題</h3>
        <p>內容...</p>
      </div>
    </article>
  </div>
</aside>

<main>
  <div class="card-container">
    <article class="card">
      <img src="photo.jpg" />
      <div class="card-body">
        <h3>標題</h3>
        <p>內容...</p>
      </div>
    </article>
  </div>
</main>
```

以前用媒體查詢，只能根據瀏覽器視口來決定樣式——但這裏的卡片組件需要根據父容器寬度來決定佈局。

## 基本用法

```css
/* 1. 定義容器 */
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

/* 默認樣式（小容器） */
.card {
  display: block;
}

.card img {
  width: 100%;
  height: auto;
}
```

`container-type: inline-size` 告訴瀏覽器：這個元素是一個容器，需要監控它的行內方向（水平）尺寸變化。

## 容器查詢單位

和視口單位類似，Container Queries 也引入了容器相對單位：

```css
/* cqw = 容器寬度的 1% */
.card-title {
  font-size: clamp(14px, 3cqw, 24px);
}

/* cqh = 容器高度的 1% */
.hero-banner {
  height: clamp(200px, 50cqh, 400px);
}

/* cqi/cqbi = 行內方向 */
.sidebar-text {
  font-size: max(12px, 2.5cqi);
}
```

## 組件庫中的實際應用

```css
/* Button 組件的響應式 */
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
/* 表單組件的響應式 */
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
/* 頁面有多種容器，用 container-name 區分 */
.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

.main-content {
  container-type: inline-size;
  container-name: main;
}

/* 只響應側邊欄的尺寸變化 */
@container sidebar (min-width: 300px) { ... }

/* 只響應主內容區的尺寸變化 */
@container main (min-width: 800px) { ... }

/* 不指定名字的 query 會匹配最近的容器 */
@container (min-width: 400px) { ... }
```

## 與 CSS 變量結合

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

## 瀏覽器支持（2022 年中）

Chrome 105+、Edge 105+、Safari 16+、Firefox 110+。對於不支持的瀏覽器，可以用 PostCSS 插件降級：

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

## 小結

Container Queries 解決了組件化開發中最基本的需求：讓組件根據自己的容器響應式調整佈局，而不是依賴全局視口。這是 CSS 響應式設計從「頁面級」到「組件級」的進化。現在主流瀏覽器都已支持，是時候在組件庫中用起來了。