---
title: "CSS :has() 選擇器高階應用：2024 實戰場景全解析"
date: 2024-10-02 10:00:00
tags:
  - CSS
readingTime: 2
description: "`:has()` 偽類選擇器自 2023 年底在主流瀏覽器全面落地後，2024 年已經完全可以投入生產使用（Chrome 105+、Firefox 121+、Safari 15.4+，全球支援率超過 92%）。它被稱為\"父選擇器\"，但實際上遠比這強大——它可以根據**任意後代或兄弟**的狀態來匹配元素。本文整理了 20"
---

`:has()` 偽類選擇器自 2023 年底在主流瀏覽器全面落地後，2024 年已經完全可以投入生產使用（Chrome 105+、Firefox 121+、Safari 15.4+，全球支援率超過 92%）。它被稱為"父選擇器"，但實際上遠比這強大——它可以根據**任意後代或兄弟**的狀態來匹配元素。本文整理了 2024 年最有價值的實戰場景。

## 基礎：:has() 的語義

```css
/* 選中"包含 img 的 .card" */
.card:has(img) {
}

/* 選中"包含 :checked 的 li" */
li:has(input:checked) {
}

/* 選中"緊跟在 h2 後面的 p"（配合相鄰兄弟選擇器）*/
h2:has(+ p) {
}
/* 等價於"後面緊跟著 p 的 h2" */
```

## 場景 1：表單驗證狀態樣式

```css
/* 輸入框聚焦時，整個 form-group 高亮 */
.form-group:has(input:focus) {
  outline: 2px solid #0066ff;
  border-radius: 4px;
}

/* 包含 required 輸入框的 label 顯示星號 */
.form-group:has(input:required) .label::after {
  content: " *";
  color: #e53e3e;
}

/* 輸入框有錯誤時，整個 form-group 變紅 */
.form-group:has(input:invalid:not(:placeholder-shown)) {
  background: #fff5f5;
}

.form-group:has(input:invalid:not(:placeholder-shown)) .error-message {
  display: block; /* 顯示錯誤提示 */
}
```

## 場景 2：卡片佈局自適應媒體內容

```css
/* 含圖片的卡片：圖片全寬，無內邊距 */
.card:has(> img:first-child) {
  padding: 0;
}

.card:has(> img:first-child) .card-content {
  padding: 16px;
}

/* 含影片的卡片：特殊寬高比容器 */
.card:has(video) {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

/* 含多張圖片（gallery 卡片）：網格佈局 */
.card:has(.image-gallery) {
  display: grid;
  grid-template-rows: auto 1fr;
}
```

## 場景 3：導航與選單狀態

```css
/* 導航項被啟用時，高亮父導航組 */
.nav-group:has(.nav-item.active) {
  background: rgba(0, 102, 255, 0.05);
}

.nav-group:has(.nav-item.active) .nav-group-title {
  color: #0066ff;
  font-weight: 600;
}

/* 下拉選單開啟時，調整觸發按鈕樣式 */
.dropdown:has(.dropdown-menu:not([hidden])) .trigger-btn {
  background: #f0f0f0;
  border-color: #0066ff;
}

/* 含子選單的 li 新增展開箭頭 */
nav li:has(ul)::after {
  content: " ›";
  opacity: 0.5;
}
```

## 場景 4：資料密度感知的表格

```css
/* 當表格超過 6 列時，縮小字號和內邊距 */
table:has(th:nth-child(7)) {
  font-size: 13px;
}

table:has(th:nth-child(7)) th,
table:has(th:nth-child(7)) td {
  padding: 6px 8px; /* 正常是 10px 12px */
}

/* 含核取方塊列的表格，第一列固定寬度 */
table:has(td input[type="checkbox"]) td:first-child {
  width: 40px;
  text-align: center;
}
```

## 場景 5：對話方塊/Modal 背景滾動鎖定

```css
/* 當 body 內有開啟的 dialog 時，禁止滾動 */
body:has(dialog[open]) {
  overflow: hidden;
}

/* 有遮罩層時，主內容模糊 */
body:has(.overlay.visible) main {
  filter: blur(2px);
  pointer-events: none;
}
```

## 場景 6：深色/淺色模式手動切換

```css
/* 當 html 上有 data-theme="dark" 時，全域性深色模式 */
/* 使用 :has() 讓切換更靈活（不依賴 class 層級）*/
:root:has([data-theme="dark"]) {
  --bg: #1a1a1a;
  --text: #f0f0f0;
}

/* 使用者的"暗模式開關"是某個 checkbox */
:root:has(#dark-mode-toggle:checked) {
  color-scheme: dark;
  --bg: #1a1a1a;
}
```

## 效能注意事項

`:has()` 的計算比普通選擇器更昂貴，因為需要檢查後代：

```css
/* ✅ 效能較好：限制了查詢範圍 */
.specific-container:has(> .direct-child.active) {
}

/* ⚠️ 效能較差：全域性掃描所有元素的所有後代 */
*:has(.some-class) {
}

/* ✅ 避免在大型列表中使用深層 :has() */
/* ❌ 如果列表有 10000 項，這會很慢 */
.list-item:has(.deeply > .nested > .element) {
}
```

## 總結

`:has()` 是 CSS 歷史上少數幾個真正改變程式設計模型的特性之一。2024 年瀏覽器支援率已超過 92%，可以放心用於生產（漸進增強方式降級也很簡單）。本文列舉的表單狀態、卡片佈局、導航選單、Modal 鎖定等場景，每一個都曾經需要 JavaScript 來實現，現在純 CSS 即可搞定。
