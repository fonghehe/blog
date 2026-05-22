---
title: "CSS Anchor Positioning：2025 年從實驗到實戰"
date: 2025-09-24 09:38:15
tags:
  - CSS
readingTime: 2
description: "CSS Anchor Positioning（CSS 錨點定位）在 2024 年進入 Chrome 125+ 後，2025 年隨着 Firefox 和 Safari 的跟進，終於達到了可以實際使用的支援度（全球 ~78%）。它解決了前端長期依賴 JavaScript 計算位置的\"懸浮 UI\"問題：Tooltip、Pop"
wordCount: 292
---

CSS Anchor Positioning（CSS 錨點定位）在 2024 年進入 Chrome 125+ 後，2025 年隨着 Firefox 和 Safari 的跟進，終於達到了可以實際使用的支援度（全球 ~78%）。它解決了前端長期依賴 JavaScript 計算位置的"懸浮 UI"問題：Tooltip、Popover、下拉菜單、浮動面板——這些全靠錨點定位就能實現，無需 Popper.js、Floating UI 等庫。

## 核心概念：錨點與定位元素

```css
/* 1. 定義錨點（被引用的元素）*/
.trigger-button {
  anchor-name: --my-anchor; /* 給元素起一個錨點名稱 */
}

/* 2. 定位元素：相對錨點定位 */
.tooltip {
  position: absolute; /* 必須是絕對/固定定位 */
  position-anchor: --my-anchor; /* 綁定到錨點 */

  /* anchor() 函數：引用錨點的各條邊 */
  bottom: anchor(top); /* 緊貼錨點的上邊緣 */
  left: anchor(left); /* 左對齊 */

  /* 水平居中於錨點 */
  left: calc(anchor(left) + (anchor(width) / 2));
  translate: -50% 0;
}
```

## 實戰：純 CSS Tooltip

```html
<button class="btn" popovertarget="tip">
  懸停查看提示
  <span id="tip" popover>這是一個純 CSS Tooltip，無需 JS！</span>
</button>
```

```css
.btn {
  anchor-name: --btn-anchor;
  position: relative; /* 作為 containing block */
}

#tip {
  position: fixed; /* fixed 才能相對錨點定位到視口任意位置 */
  position-anchor: --btn-anchor;

  /* 默認顯示在按鈕上方居中 */
  bottom: calc(anchor(top) - 8px);
  left: anchor(center);
  translate: -50% 0;

  /* 樣式 */
  background: #1a1a2e;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 箭頭 */
#tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  border: 6px solid transparent;
  border-top-color: #1a1a2e;
}
```

## @position-try：自動翻轉（溢出處理）

當錨點靠近視口邊緣時，彈出層需要自動翻轉方向：

```css
.popover {
  position: fixed;
  position-anchor: --trigger;

  /* 默認：顯示在下方 */
  top: anchor(bottom);
  left: anchor(left);

  /* 自動翻轉規則 */
  position-try-fallbacks:
    --above,
    /* 嘗試方案 1 */ --left,
    /* 嘗試方案 2 */ --right; /* 嘗試方案 3 */
}

/* 定義翻轉方案 */
@position-try --above {
  top: auto;
  bottom: anchor(top); /* 顯示在上方 */
}

@position-try --left {
  left: auto;
  right: anchor(left); /* 顯示在左側 */
}

@position-try --right {
  left: anchor(right); /* 顯示在右側 */
}
```

## 實戰：下拉選擇菜單（Select 替代品）

```css
/* 觸發按鈕 */
.select-trigger {
  anchor-name: --select-trigger;
}

/* 下拉列表 */
.select-dropdown {
  position: fixed;
  position-anchor: --select-trigger;

  /* 與觸發按鈕同寬，顯示在其正下方 */
  top: anchor(bottom);
  left: anchor(left);
  width: anchor-size(width); /* anchor-size()：獲取錨點尺寸 */
  min-width: 120px;

  position-try-fallbacks: --above;
  margin-top: 4px;

  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

@position-try --above {
  top: auto;
  bottom: calc(anchor(top) - 4px);
}
```

## 與 Floating UI 的對比

```
                  Floating UI/Popper.js    CSS Anchor Positioning
────────────────────────────────────────────────────────────────
實現方式          JavaScript              純 CSS
包體積            ~12KB gzip              0（瀏覽器原生）
動態計算          每次滾動/resize 重算    瀏覽器自動處理
自動翻轉          手動配置 middleware     @position-try
SSR 相容          需要處理 hydration      無問題
瀏覽器支持        全部                   ~78%（2025年9月）
複雜場景          更靈活                 有限製
```

**推薦策略**：新項目可以用 CSS Anchor Positioning 處理簡單場景（Tooltip、下拉），複雜交互（有動畫、複雜對齊邏輯）仍可保留 Floating UI。

## 總結

CSS Anchor Positioning 是"JavaScript 做 CSS 工作的歷史終於結束了"的又一個例子。2025 年隨着 Firefox 支持到來，它已經到了"漸進增強使用"的階段。對於內部工具和 B 端系統（可以要求現代瀏覽器），現在完全可以用它替代 Popper.js/Floating UI 的基礎場景。
