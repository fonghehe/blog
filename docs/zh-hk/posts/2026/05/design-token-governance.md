---
title: "設計 Token 治理：讓設計系統真正進入工程閉環"
date: 2026-05-26 11:13:54
tags:
  - 設計系統
  - CSS
readingTime: 6
description: "設計 Token 的價值不隻是統一顏色和間距，更在於把設計決策變成可版本化、可審查、可發佈的工程資產。本文討論 Token 分層、變更審查和跨端同步。"
wordCount: 1528
---

設計 Token 的價值在 2026 年已經被廣泛認可——但真正落地的團隊並不多。問題不在於「要不要用 Token」，而在於「Token 怎麼管才能不變成另一種爛程式碼」。本文從實際工程經驗出發，討論設計 Token 的分層架構、變更治理和跨端同步機製。

## Token 三層模型：不隻是顏色和間距

業界主流的 Token 分層模型在 2026 年已經收斂為三個層級：

**第一層：基礎 Token（Primitive / Global Tokens）**

這是最底層、最原子的設計決策。典型內容包括：

- 色板（如 `blue-500: #3B82F6`、`neutral-100: #F5F5F5`）
- 間距階梯（如 `space-4: 4px`、`space-16: 16px`）
- 字號階梯（如 `font-size-sm: 0.875rem`、`font-size-xl: 1.25rem`）
- 圓角、陰影、字重等基礎屬性

基礎 Token 是**純粹的值定義**，不包含語義。它們通常由設計工具（Figma Tokens Studio 等）直接匯出，前端不應該手動修改。

**第二層：語義 Token（Semantic / Alias Tokens）**

這一層把基礎 Token 對應到有意義的用途上：

- `color-text-primary` → `neutral-900`
- `color-surface-brand` → `blue-500`
- `spacing-card-padding` → `space-16`
- `font-size-heading` → `font-size-xl`

語義 Token 的關鍵價值在於**用途穩定，但值可以切換**。比如暗色模式下 `color-text-primary` 從 `neutral-900` 切換到 `neutral-100`，但組件程式碼完全不需要改。又比如品牌升級時隻需要改 Token 對應關係，不用逐個組件改顏色值。

**第三層：組件 Token（Component Tokens）**

這一層直接對應組件庫的具體組件：

- `button-primary-bg` → `color-surface-brand`
- `card-padding-x` → `spacing-card-padding`
- `input-border-radius` → `radius-md`

組件 Token 的優勢是**顯式化組件的設計依賴**。當你想知道一個 `Button` 組件用了哪些設計決策時，看它的 Token 就夠了，不需要翻原始碼。

## Token 的工程化管理：從 Figma 到程式碼

2026 年比較成熟的工具鏈是：

1. **設計側**：設計師在 Figma 中使用 Tokens Studio 外掛定義 Token，匯出為 JSON
2. **同步層**：使用 Style Dictionary 或 Tokens Studio 的 CI 外掛，將 JSON 轉換為多平臺格式（CSS 變數、Tailwind 設定、iOS/Android 資源檔案）
3. **消費側**：前端組件通過 CSS 變數或 Tailwind 主題引用 Token

推薦的目錄結構：

```
design-tokens/
├── primitives/
│   ├── colors.json
│   ├── spacing.json
│   └── typography.json
├── semantic/
│   ├── light.json
│   └── dark.json
├── components/
│   ├── button.json
│   └── card.json
├── build/
│   ├── css-variables.css
│   ├── tailwind.config.ts
│   └── index.ts
└── scripts/
    └── build-tokens.ts
```

## Token 變更的審查流程

Token 變更是高風險操作——改一個基礎顏色可能影響幾十個組件。2026 年的實踐是建立 Token 專用的變更流程：

**變更類型分級：**

- **P3（新增 Token）**：新增新的 Token 值，不影響已有組件。正常 PR 流程即可。
- **P2（修改語義對應）**：如 `color-text-primary` 從 `neutral-900` 改為 `neutral-800`。需要提供視覺回歸測試截圖，並在 PR 中 @ 設計師審批。
- **P1（修改基礎 Token）**：如修改色板中的 `blue-500` 值。需要發起 RFC，評估影響範圍，並在 staging 環境中做全量回歸。

**自動化檢查：**

- Token JSON 的 Schema 校驗（防止拼寫錯誤和類型錯誤）
- 檢測孤立的 Token（定義了但沒有被引用）
- 檢測未定義的引用（組件引用了不存在的 Token）
- 視覺回歸測試（Chromatic / Percy 自動截圖對比）

## 跨端同步：不止是 Web

設計 Token 的真正價值在跨端場景中才能完全體現。2026 年愈來愈多的團隊需要同時支援 Web、小程序、React Native 和桌面端。Token 同步的挑戰包括：

**平臺差異對應：**
不同平臺的能力不同。CSS 支援 `rgba()` 和 `var()`，小程序可能隻支援 HEX 顏色。Transform 函式需要按平臺生成不同的輸出格式。好的做法是在 build 指令碼中為每個平臺維護一個 transformer，輸入是統一的 Token JSON，輸出是平臺原生的格式。

**版本同步策略：**
設計 Token 的發佈頻率通常低於業務程式碼但高於大版本。推薦的節奏是：
- 每週從 Figma 同步最新 Token 到程式碼倉庫
- 非破壞性變更（新增 Token、修改不影響現有組件語義對應的 Token）自動合併
- 破壞性變更觸發人工審批流程

**暗色模式和多主題：**
Token 模型天然支援多主題，但需要注意：不是給每個組件寫兩套樣式，而是讓 Token 在不同主題下對應到不同值。組件程式碼本身應該是主題無關的：

```css
/* ✅ 正確：組件隻引用語義 Token */
.button {
  background: var(--color-surface-brand);
  color: var(--color-text-on-brand);
}

/* ❌ 錯誤：組件直接引用基礎 Token */
.button {
  background: var(--blue-500);
  color: var(--white);
}
```

## 團隊協作中的 Token 治理

Token 治理最難的部分不是技術，而是人。設計師和開發者對 Token 的理解經常不在一個層面上。幾個讓協作更順暢的實踐：

1. **Token 是共同語言**：PR 討論中用 Token 名稱而不是具體值來溝通。「這個按鈕用 `color-surface-brand` 是不是太重了」比「這個按鈕的藍色改成 #4A90D9」更有利於決策。

2. **Token 的 owner 是設計系統團隊**：無論組織架構如何，設計 Token 需要有一個明確的 owner，負責審核變更、維護一致性和文檔。

3. **入門文檔不要隻講格式，要講意圖**：與其寫「`spacing-md` 的值是 8px」，不如寫「`spacing-md` 用於組件內部元素的間距，例如按鈕內部的 padding、列表項之間的間距」。

4. **定期的 Token 審計**：每季度檢查一次 Token 的使用情況。哪些 Token 從未被使用？哪些 Token 的值在不同端不一致？哪些 Token 的命名已經不能反映當前的設計意圖？

## 小結

設計 Token 治理不是「匯出 JSON 放到程式碼倉庫」就完事了。它需要三層分層架構（基礎→語義→組件）、工程化的建置管線、分級變更審查流程和跨端同步機製。更重要的是，Token 是設計和工程之間的契約——好的 Token 體系讓設計師可以獨立迭代設計語言，也讓開發者不需要逐個像素地理解設計意圖。2026 年的前端團隊，如果還沒有建立 Token 治理流程，現在就是最好的起點。
