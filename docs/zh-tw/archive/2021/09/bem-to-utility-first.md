---
title: "CSS 架構演進：從 BEM 到 Utility-First"
date: 2021-09-27 14:31:11
tags:
  - 前端
  - CSS
readingTime: 2
description: "今年在團隊內推動了一次 CSS 架構的升級——從 BEM 命名規範逐步遷移到 Utility-First 方案。過程中有爭論、有妥協，最終找到了一個平衡點。"
wordCount: 421
---

今年在團隊內推動了一次 CSS 架構的升級——從 BEM 命名規範逐步遷移到 Utility-First 方案。過程中有爭論、有妥協，最終找到了一個平衡點。

## BEM 的痛點

BEM（Block-Element-Modifier）我們用了 4 年，解決了命名衝突問題，但隨著專案變大，新問題逐漸暴露：

```css
/* BEM 的典型程式碼 */
.card { }
.card__header { }
.card__header__title { }
.card__header__title--highlighted { }
.card__body { }
.card__body__content { }
.card__body__content--loading { }

/* 問題一：巢狀層級深時命名爆炸 */
.data-table__row__cell__link__icon--active { }

/* 問題二：每個元件都要寫一大堆 CSS */
/* card.css - 200+ 行，其中 60% 是佈局和間距 */
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
}
/* 這些 flex、padding、margin 在無陣列件中重複 */
```

核心問題是：CSS 檔案膨脹、佈局樣式重複、命名心智負擔高。

## Utility-First 的優勢

```html
<!-- 以前：HTML + 對應的 BEM CSS -->
<div class="card">
  <div class="card__header">
    <h3 class="card__header__title">標題</h3>
  </div>
</div>

<!-- Utility-First：樣式直接在 HTML 中 -->
<div class="rounded-lg bg-white shadow-md">
  <div class="flex items-center justify-between p-4 mb-3">
    <h3 class="text-lg font-semibold text-gray-900">標題</h3>
  </div>
</div>
```

優點很明顯：不用在 HTML 和 CSS 之間跳轉，不用想命名，樣式一目瞭然。但初期團隊的牴觸也很大——"HTML 太醜了"、"和內聯樣式有什麼區別"。

## 我們的折中方案

沒有全盤用 Utility-First，而是分層處理：

```html
<!-- 1. 佈局用 utility classes -->
<div class="grid grid-cols-3 gap-4 p-6">
  <!-- 2. 元件語義部分用 BEM -->
  <article class="card">
    <div class="card__header">
      <!-- 3. 細節調整用 utility classes -->
      <h3 class="card__title text-lg mb-1">標題</h3>
      <span class="card__badge bg-red-500 text-white px-2 py-0.5 rounded">
        NEW
      </span>
    </div>
    <div class="card__body text-gray-600">
      內容
    </div>
  </article>
</div>
```

原則是：
- **佈局和間距**：用 utility classes，不寫 CSS
- **元件的結構樣式**：用 BEM，保持語義
- **顏色和字型微調**：用 utility classes

## 用 CSS 變數統一 Design Token

不管用什麼 CSS 方法論，Design Token 都應該統一管理：

```css
:root {
  /* 間距系統 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* 顏色系統 */
  --color-primary: #1890ff;
  --color-text: #333;
  --color-text-secondary: #666;

  /* 字型 */
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* 圓角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* 元件中使用 */
.card {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  color: var(--color-text);
}
```

## 工具鏈配置

我們用 Windi CSS（相容 Tailwind 的 API）作為 utility 工具，配合 Vite 使用：

```javascript
// vite.config.ts
import WindiCSS from 'vite-plugin-windicss'

export default {
  plugins: [
    WindiCSS({
      scan: {
        dirs: ['src'],
        fileExtensions: ['vue', 'ts', 'jsx']
      }
    })
  ]
}
```

Windi CSS 的按需生成特性讓最終 CSS 體積很小，而且 JIT 模式下所有 utility 都是按需編譯的。

## 小結

- BEM 不是過時了，而是在佈局和間距層面過於冗餘
- Utility-First 不適合全盤採用，和 BEM 結合使用是更好的方案
- Design Token 用 CSS 變數管理，不管用什麼方法論都需要
- Windi CSS / Tailwind JIT 讓 Utility-First 方案的執行時開銷幾乎為零
- 團隊接受度需要漸進式推進，先從佈局樣式開始