---
title: "CSS if() 函式：2025 年最期待的 CSS 新原語"
date: 2025-01-15 10:00:00
tags:
  - CSS
readingTime: 2
description: "CSS `if()` 函式在 State of CSS 2023 調查中以\"最期待的新特性\"高票通過後，2025 年終於迎來了瀏覽器實驗性實現。它將允許在 CSS 屬性值中內聯書寫條件邏輯，徹底改變目前必須靠 CSS 變數 + 媒體查詢 + 選擇器拼湊的條件樣式寫法。"
wordCount: 308
---

CSS `if()` 函式在 State of CSS 2023 調查中以"最期待的新特性"高票通過後，2025 年終於迎來了瀏覽器實驗性實現。它將允許在 CSS 屬性值中內聯書寫條件邏輯，徹底改變目前必須靠 CSS 變數 + 媒體查詢 + 選擇器拼湊的條件樣式寫法。

> **注意**：截至 2025 年 1 月，`if()` 仍處於 CSS Working Group 規範草案階段，Chrome 實驗性標誌後可用，尚未穩定。

## 當前痛點：條件樣式的變通方案

```css
/* 現在要根據變數寫條件樣式，只能用選擇器變通 */
:root {
  --is-dark: 0; /* 0 或 1 */
}

/* 利用 calc() hack（只適用於數值） */
.bg {
  /* (1 - var(--is-dark)) × 255 + var(--is-dark) × 0 */
  /* 0 → 255（白色），1 → 0（黑色）*/
  background: rgb(
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255)
  );
}

/* 或者靠 CSS 選擇器 :has()/:is() */
:root:has([data-theme="dark"]) .bg {
  background: black;
}
:root:not(:has([data-theme="dark"])) .bg {
  background: white;
}
```

## CSS if() 語法（規範草案）

```css
/* 基本語法 */
.element {
  color: if(style(--variant: primary): blue; else: gray);
}

/* 多條件 */
.button {
  background: if(
    style(--size: large): hsl(200 80% 40%) ;
      style(--size: small): hsl(200 80% 60%) ; else: hsl(200 80% 50%)
  );

  padding: if(
    style(--size: large): 12px 24px; style(--size: small): 4px 8px; else: 8px
      16px
  );
}

/* 使用 media 條件 */
.layout {
  display: if(media(width >= 768px): grid; else: flex);

  grid-template-columns: if(
    media(width >= 1024px): repeat(3, 1fr) ;
      media(width >= 768px): repeat(2, 1fr) ; else: 1fr
  );
}

/* 使用 supports 條件 */
.animation {
  animation-timeline: if(
    supports(animation-timeline: scroll()): scroll() ; else: none
  );
}
```

## if() 與自定義屬性組合：元件變體系統

這是 `if()` 最強大的應用場景——無需修改 HTML 結構，純靠 CSS 變數驅動元件變體：

```css
/* 定義一個支援 variant 和 size 變體的按鈕 */
.button {
  --variant: primary; /* 預設值 */
  --size: md;

  /* 使用 if() 根據變數決定所有相關屬性 */
  background: if(
    style(--variant: primary): var(--color-primary) ;
      style(--variant: secondary): transparent;
      style(--variant: danger): var(--color-danger) ; else: var(--color-primary)
  );

  color: if(style(--variant: secondary): var(--color-primary) ; else: white);

  border: if(
    style(--variant: secondary): 1px solid var(--color-primary) ; else: none
  );

  padding: if(
    style(--size: sm): 4px 10px; style(--size: lg): 12px 28px; else: 8px 16px
  );

  font-size: if(style(--size: sm): 13px; style(--size: lg): 17px; else: 15px);
}
```

```html
<!-- 僅通過 CSS 變數切換變體 -->
<button class="button" style="--variant: primary; --size: lg">
  大號主按鈕
</button>
<button class="button" style="--variant: secondary">次要按鈕</button>
<button class="button" style="--variant: danger; --size: sm">
  小號危險按鈕
</button>
```

## 與現有方案的對比

```
方案對比（以"按鈕變體"為例，3 種變體 × 3 種尺寸）：

方案               程式碼量    動態切換    執行時 JS    選擇器特異性
─────────────────────────────────────────────────────────────────
CSS 類名 (.btn-primary-lg)    多        靠 JS     需要         累加
CSS 變數 + 計算 hack          多        CSS 變數   無           無影響
CSS 選擇器 :has() 組合        較多      CSS 變數   無           有影響
CSS if()（未來）              少        CSS 變數   無           無影響
```

## 目前如何試用

```bash
# Chrome 125+ 開啟實驗標誌
# 位址列輸入：chrome://flags
# 搜尋：CSS if()
# 或：--enable-experimental-web-platform-features
```

```css
/* 或通過 PostCSS 外掛轉換（polyfill 方案，部分相容）*/
/* postcss-if-value 等外掛正在開發中 */
```

## 總結

CSS `if()` 代表了 CSS 條件邏輯的未來方向——將元件變體的邏輯內聯到 CSS 中，減少對 JavaScript 的依賴，同時讓 CSS 變數真正成為"主題/狀態的單一來源"。雖然 2025 年初仍不適合生產使用，但值得現在就瞭解語法，等穩定化之後可以快速遷移。
