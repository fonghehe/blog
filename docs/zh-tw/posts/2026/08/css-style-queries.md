---
title: "CSS Style Queries 實戰：用自訂屬性驅動元件變體"
date: 2026-08-21 14:06:19
tags:
  - CSS
readingTime: 6
description: "CSS Style Queries（@container style(...)）進入 Baseline 2026，終於可以根據自訂屬性的值來套用樣式。本文聚焦實際用法：主題切換不靠 class、元件變體由 custom property 驅動、與 @property 的配合，以及降級策略。"
wordCount: 1217
---

Container Queries 解決了「根據容器尺寸回應」的問題，但它有一個盲區：你無法根據容器的狀態（比如當前主題、密度模式、品牌色）來改變子元件樣式。過去我們要麼加一堆 class（`.dark`、`.compact`、`.brand-acme`），要麼在 JS 裡算好再傳 props。Style Queries 補上了這塊——它讓你直接用 `@container style(...)` 查詢自訂屬性的值，把元件變體的控制權交還給 CSS。

## Style Queries 基礎語法

Style Queries 的語法和 Size Container Queries 類似，但查詢目標從尺寸變成了自訂屬性：

```css
/* 宣告一個 style query container */
.card-wrapper {
  container-type: normal; /* style queries 不需要 size containment */
}

/* 當 --theme 等於 dark 時 */
@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #333;
  }
}

/* 當 --density 等於 compact 時 */
@container style(--density: compact) {
  .card {
    padding: 8px 12px;
    font-size: 0.875rem;
  }
}
```

注意 `container-type: normal`——style queries 不需要 `size` 或 `inline-size`，因為查詢的是屬性值而非尺寸。這意味著你可以給任何元素設定 style container，不會觸發布局限制。

## 主題切換：告別全域 .dark class

傳統暗色主題的典型做法是在 `<html>` 上加 `.dark` class，然後用後代選擇器覆蓋所有顏色。問題是當頁面中需要同時存在明暗兩種主題區域時（比如嵌入式 widget、預覽面板），全域 class 就失效了。

用 Style Queries，主題作用域跟著容器走：

```css
/* 註冊自訂屬性，確保類型正確 */
@property --theme {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: light;
}

/* 主題容器 */
.theme-scope {
  container-type: normal;
  --theme: light;
}

.theme-scope[data-theme="dark"] {
  --theme: dark;
}

/* 元件樣式根據容器主題自動切換 */
@container style(--theme: dark) {
  .button {
    background: var(--color-primary-dark);
    color: #fff;
  }

  .input {
    background: #2a2a3e;
    border-color: #444;
    color: #eee;
  }
}

@container style(--theme: light) {
  .button {
    background: var(--color-primary);
    color: #fff;
  }

  .input {
    background: #fff;
    border-color: #ddd;
    color: #333;
  }
}
```

```html
<!-- 同一頁面中兩個不同主題的區域 -->
<div class="theme-scope" data-theme="light">
  <div class="card">亮色區域的卡片</div>
</div>

<div class="theme-scope" data-theme="dark">
  <div class="card">暗色區域的卡片</div>
</div>
```

這裡的關鍵是 `inherits: true`。`--theme` 會沿著 DOM 樹向下繼承，所以只需要在容器層級設定一次，內部所有子元件都能透過 style query 感知到。這比在每個元件上綁定 class 乾淨得多。

## 元件變體由 Custom Property 驅動

Style Queries 最有價值的場景是把元件變體從 class 組合爆炸中解放出來。以一個 Card 元件為例，它有尺寸（small/medium/large）、色調（neutral/accent/warning）、密度（comfortable/compact）三個維度。用 class 組合需要 3×3×3=27 個選擇器；用 custom properties + style queries 只需要每個維度獨立處理。

```css
/* 註冊變體屬性 */
@property --card-size {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: medium;
}

@property --card-tone {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: neutral;
}

@property --card-density {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: comfortable;
}

/* 基礎樣式 */
.card {
  container-type: normal;
  border-radius: 8px;
  transition: all 0.2s ease;
}

/* === 尺寸維度 === */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-size: medium) {
  .card { padding: 20px; font-size: 0.9375rem; }
}
@container style(--card-size: large) {
  .card { padding: 28px; font-size: 1.0625rem; }
}

/* === 色調維度 === */
@container style(--card-tone: neutral) {
  .card { background: var(--surface-1); border: 1px solid var(--border-subtle); }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border: 1px solid var(--color-primary); }
}
@container style(--card-tone: warning) {
  .card { background: var(--surface-warning); border: 1px solid var(--color-warning); }
}

/* === 密度維度 === */
@container style(--card-density: compact) {
  .card { gap: 4px; line-height: 1.4; }
  .card__actions { margin-top: 8px; }
}
@container style(--card-density: comfortable) {
  .card { gap: 12px; line-height: 1.6; }
  .card__actions { margin-top: 16px; }
}
```

使用側只需要設定屬性值：

```html
<div style="--card-size: large; --card-tone: accent; --card-density: compact;">
  <div class="card">
    <h3>大尺寸強調緊湊卡片</h3>
    <p>三個維度獨立控制，無 class 組合。</p>
  </div>
</div>
```

在 Vue / React 元件中，這些 custom properties 可以透過 props 映射：

```vue
<template>
  <div
    :style="{
      '--card-size': size,
      '--card-tone': tone,
      '--card-density': density,
    }"
  >
    <div class="card">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  tone?: 'neutral' | 'accent' | 'warning'
  density?: 'compact' | 'comfortable'
}>()
</script>
```

元件樣板完全不包含變體邏輯，所有視覺差異由 CSS style queries 處理。設計系統更新時只改 CSS，不改元件程式碼。

## 與 @property 的配合：為什麼註冊很重要

上面的例子都用了 `@property` 註冊自訂屬性。這不是可選的——如果不註冊，瀏覽器會把自訂屬性當作未類型化的字串，style query 的匹配行為可能不符合預期。

具體來說：

| 特性 | 未註冊屬性 | @property 註冊後 |
|------|-----------|-----------------|
| 語法檢查 | 無 | 按 syntax 校驗 |
| 繼承行為 | 預設繼承 | 由 inherits 控制 |
| 初始值 | 無（空值不匹配） | 有 initial-value |
| 動畫支援 | 不支援 | 按 syntax 插值 |
| Style Query 匹配 | 僅精確字串匹配 | 類型化匹配 |

一個容易踩的坑：未註冊的屬性如果值為空（比如某個祖先沒設定），style query 不會匹配任何分支，元件會回退到基礎樣式。註冊後有了 `initial-value`，始終有一個確定的匹配目標。

```css
/* 註冊時指定非繼承 + 初始值 */
@property --card-highlight {
  syntax: '<color>';
  inherits: false;
  initial-value: transparent;
}

/* 只在明確設定了高亮色的容器中生效 */
@container style(--card-highlight) {
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--card-highlight);
  }
}
```

這裡 `@container style(--card-highlight)` 不帶冒號和值，表示「只要該屬性存在且非初始值就匹配」。這是 style queries 的一個便捷寫法，適合開關型的變體。

## 降級策略：不支援 Style Queries 怎麼辦

截至 2026 年 8 月，Style Queries 已經是 Baseline Newly Available，Chrome 136+、Firefox 138+、Safari 18.4+ 均支援。但仍有一部分使用者停留在舊版本，降級方案需要提前考慮。

**策略一：@supports 偵測 + class fallback**

```css
/* 現代瀏覽器：用 style queries */
@supports (container-type: normal) and (style(--theme: dark)) {
  @container style(--theme: dark) {
    .card { background: #1a1a2e; color: #e0e0e0; }
  }
}

/* 降級：用傳統 class */
@supports not ((container-type: normal) and (style(--theme: dark))) {
  .theme-dark .card { background: #1a1a2e; color: #e0e0e0; }
}
```

**策略二：漸進增強——基礎樣式保底**

把最通用的變體作為預設樣式，style queries 只做增強。這樣即使不支援，元件也有可用的外觀：

```css
/* 預設 = neutral + medium + comfortable */
.card {
  padding: 20px;
  font-size: 0.9375rem;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
}

/* style queries 覆蓋非預設值 */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border-color: var(--color-primary); }
}
```

我推薦策略二。它不需要維護兩套選擇器，降級體驗只是回到預設外觀而非完全錯亂。對於面向公眾的內容站，這個 trade-off 是可以接受的。

## 與 Size Container Queries 的組合

Style Queries 和 Size Container Queries 可以在同一個容器上疊加使用：

```css
.card-wrapper {
  container-type: inline-size; /* 同時支援 size 和 style queries */
  --card-tone: neutral;
}

/* 窄容器 + accent 色調 */
@container (max-width: 300px) and style(--card-tone: accent) {
  .card {
    flex-direction: column;
    border-left: none;
    border-top: 3px solid var(--color-primary);
  }
}

/* 寬容器 + accent 色調 */
@container (min-width: 301px) and style(--card-tone: accent) {
  .card {
    flex-direction: row;
    border-top: none;
    border-left: 3px solid var(--color-primary);
  }
}
```

這種組合能力是 class 方案幾乎不可能優雅實現的——你需要為每種尺寸×狀態的組合寫一個獨立 class，而 CSS 原生就能表達這個二維關係。

## 小結

Style Queries 填補了 CSS 條件樣式的一塊關鍵空白：基於狀態而非尺寸的回應式設計。在實際專案中，它的最大價值是消除 class 組合爆炸和減少 JS 層的樣式邏輯。配合 `@property` 註冊獲得型別安全，配合 `@supports` 做好降級，配合 Size Container Queries 實現多維回應。如果你的設計系統還在用大量 modifier class 管理變體，Style Queries 是一個值得投入的重構方向。它不是替代現有方案的銀彈，但在元件變體管理和局部主題切換這兩個場景中，確實比之前的任何純 CSS 方案都更直接。
