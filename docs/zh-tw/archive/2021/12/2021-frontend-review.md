---
title: "2021 前端生態回顧：Vite 之年"
date: 2021-12-13 16:06:07
tags:
  - 前端
  - 工程化
readingTime: 3
description: "2021 年快結束了，整理一下這一年前端生態的重要變化。如果用一個詞總結 2021 的前端，我會選\"Vite\"。"
---

2021 年快結束了，整理一下這一年前端生態的重要變化。如果用一個詞總結 2021 的前端，我會選"Vite"。

## 構建工具：Vite 成為事實標準

2021 年初，Vite 2.0 釋出，年底已經成為 Vue 3 和越來越多 React 專案的預設選擇。

**關鍵節點：**
- 2 月：Vite 2.0 正式釋出，採用 ESM + esbuild 預構建的架構
- 6 月：SvelteKit 預設使用 Vite
- 9 月：Vite 團隊釋出 Vitest 設計方案
- 12 月：Vite 生態外掛超過 300 個

Vite 改變了前端對"開發伺服器"的認知：不打包也能開發，按需編譯才是正道。

```bash
# Webpack 時代的啟動
npm run dev    # 等待 30s...

# Vite 時代的啟動
npm run dev    # < 1s
```

Webpack 5 在今年也做了不少最佳化（持久快取、Module Federation），但開發體驗的差距已經拉開。

## 框架格局

### Vue 生態

- **Vue 3.2**：`<script setup>` 標記為穩定，編譯時宏成為推薦寫法
- **Pinia**：成為 Vue 狀態管理的推薦方案，Vuex 5 會基於 Pinia 重新設計
- **VitePress**：文件站生成器，替代 VuePress
- **Nuxt 3**：10 月釋出 RC，基於 Vite + Nitro 服務引擎

### React 生態

- **React 18**：Alpha → Beta，年底進入 RC 階段
- **Concurrent 特性**：`useTransition`、`useDeferredValue`、Automatic Batching
- **Suspense SSR**：流式渲染 + 選擇性注水
- **Next.js 12**：Rust 編譯器（SWC）、Middleware、React 18 支援
- **Remix**：11 月開源，挑戰 Next.js

### 新興框架

- **Solid.js**：類 React 語法，無虛擬 DOM，效能極佳
- **Qwik**：可恢復性（Resumability）概念，0 JS 的互動性
- **Astro**：島嶼架構，部分水合

## CSS 的變化

- **Tailwind CSS 3.0**：JIT 成為預設模式，任意值支援
- **CSS Container Queries**：Chrome Canary 實驗性支援
- **Lightning CSS**：Rust 寫的 CSS 工具鏈（Parcel 2 使用）
- **UnoCSS**：Anthony Fu 釋出的原子化 CSS 引擎，效能優於 Windi CSS

## TypeScript

- **TypeScript 4.4**：控制流分析改進、`exactOptionalPropertyTypes`
- **TypeScript 4.5**：`Awaited` 型別、`type` 修飾符匯入
- 型別體操社群活躍：`type-fest`、`ts-toolbelt`

## 工具鏈

### 包管理

- **pnpm**：2021 年增長最快的包管理器，節省磁碟空間 + 嚴格的依賴隔離
- **Corepack**：Node.js 內建包管理器管理工具

### Monorepo

- **Turborepo**：12 月開源，Vercel 收購併開源，Go 寫的高效能構建編排
- **Nx**：持續迭代，12.9 版本支援 Vite executor
- **pnpm workspace**：成為最輕量的 Monorepo 方案

### 測試

- **Vitest**：概念形成，年底釋出 beta，基於 Vite 的單元測試框架
- **Playwright**：E2E 測試的新寵，微軟出品，跨瀏覽器支援好
- **Testing Library**：成為 React 元件測試的主流方案

## 執行時

- **Deno 1.15**：相容性提升，npm 包相容層改進
- **Bun**：Jarred Sumner 開始用 Zig 寫新的 JS 執行時（年底預告）
- **Node.js 16 LTS**：10 月成為 LTS 版本

## 值得關注的趨勢

### 1. Rust 重寫前端工具鏈

esbuild、SWC、Rome、Lightning CSS……用 Rust 或 Go 重寫 JavaScript 工具鏈的趨勢不可逆。10 倍以上的效能差距是核心驅動力。

### 2. ESM First

Vite 推動了 ESM 在開發環境的普及。瀏覽器原生 ESM 支援越來越成熟，打包不再是唯一選擇。

### 3. 編譯時最佳化

`<script setup>`、Svelte 的編譯策略、Solid 的編譯時響應性……框架越來越傾向於在編譯階段做最佳化，而不是執行時。

### 4. Edge Computing

Vercel Edge Functions、Cloudflare Workers、Deno Deploy……邊緣計算讓前端有了新的部署形態。

## 我的 2021 工具鏈

```
框架：    Vue 3 + <script setup>
構建：    Vite
狀態：    Pinia
CSS：     Tailwind CSS 3.0
包管理：  pnpm
Monorepo：pnpm workspace + Turborepo
測試：    Vitest（實驗中）+ Playwright
部署：    Vite SSR + Docker
```

## 小結

- 2021 是 Vite 之年，構建工具格局被徹底改變
- React 18 的併發特性是框架層面最重要的變化
- Rust 重寫工具鏈是趨勢，效能差距讓 JavaScript 工具相形見絀
- Monorepo 工具鏈成熟：pnpm + Turborepo 是最優組合
- 2022 年看好：Vitest 正式釋出、React 18 正式版、RSC（React Server Components）落地