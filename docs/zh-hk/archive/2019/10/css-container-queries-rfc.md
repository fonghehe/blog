---
title: "CSS Container Queries 提案解讀"
date: 2019-10-08 17:48:44
tags:
  - CSS
readingTime: 3
description: "在響應式設計中，我們一直依賴 `@media` 查詢根據視口（viewport）大小來調整佈局。但這種方式有一個根本性的缺陷：組件的行為取決於視口，而不是組件自身的尺寸。Container Queries 提案試圖解決這個問題，讓組件可以根據其父容器的尺寸來調整自身樣式。"
---

在響應式設計中，我們一直依賴 `@media` 查詢根據視口（viewport）大小來調整佈局。但這種方式有一個根本性的缺陷：組件的行為取決於視口，而不是組件自身的尺寸。Container Queries 提案試圖解決這個問題，讓組件可以根據其父容器的尺寸來調整自身樣式。

## 響應式設計的痛點

假設你有一個卡片組件，在主內容區它應該橫向排列，在側邊欄它應該縱向排列。使用 `@media` 查詢：

```css
/* 只能根據視口寬度判斷 */
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

問題在於：即使視口很寬，如果卡片被放在窄的側邊欄裏，它仍然應該以窄屏模式展示。`@media` 查詢無法處理這種場景。

## Container Queries 提案核心概念

Container Queries（也稱為 Element Queries）的核心思想是讓 CSS 可以查詢父容器的尺寸，而不是視口的尺寸。提案中的語法大致如下：

```css
/* 聲明一個查詢容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 根據容器寬度調整樣式 */
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

## 提案語法詳解

### container-type

`container-type` 定義一個元素作為查詢容器，以及它可以被查詢的維度：

```css
/* 只查詢 inline-size（水平方向寬度） */
.sidebar {
  container-type: inline-size;
}

/* 查詢 size（寬度和高度） */
.panel {
  container-type: size;
}

/* 聲明但不啓用查詢 */
.widget {
  container-type: normal;
}
```

### container-name

`container-name` 給容器命名，這樣查詢可以精確指向特定容器：

```css
.main-content {
  container-type: inline-size;
  container-name: main;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

/* 精確查詢 main 容器 */
@container main (min-width: 600px) {
  .card { /* ... */ }
}

/* 精確查詢 sidebar 容器 */
@container sidebar (min-width: 300px) {
  .card { /* ... */ }
}
```

### container 簡寫

```css
/* 等價於 container-type + container-name */
.widget-wrapper {
  container: widget / inline-size;
}
```

## 實際應用場景

### 場景一：組件庫中的響應式組件

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

### 場景二：Dashboard 儀表盤

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

## 用 ResizeObserver 模擬

在原生支持到來之前，可以用 JavaScript + ResizeObserver 模擬：

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

## 封裝成 React Hook

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
          <h3>卡片標題</h3>
          <p>卡片描述內容</p>
        </div>
      </div>
    </div>
  );
}
```

## Container Queries 與 @media 的關係

兩者是互補關係，不是替代關係：

- **@media**：適用於全局佈局決策（頁面級響應式）
- **@container**：適用於組件級響應式（組件自適應）

```css
/* 全局佈局用 @media */
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

/* 組件自適應用 @container */
@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

## 小結

- Container Queries 讓組件可以根據父容器尺寸調整樣式
- 提案核心語法：`container-type`、`container-name`、`@container`
- 解決了組件庫在不同佈局上下文中自適應的痛點
- 截至 2019 年仍處於提案階段，尚無瀏覽器原生支持
- 可用 ResizeObserver + CSS 類名方式模擬實現
- React Hook 封裝可以簡化組件中的使用
- Container Queries 與 @media 查詢是互補關係
