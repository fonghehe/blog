---
title: "前端工程師的 2021 年學習路線：深耕而非追新"
date: 2021-01-03 14:44:50
tags:
  - Vue
  - React
  - Angular
  - Webpack
  - Vite
  - Node.js
  - TypeScript
  - 測試
readingTime: 3
description: "新年第一週，適合做一次技術規劃。2020 年變化太多：Vue 3、Angular 11、webpack 5、Vite……與其追趕每一個新玩意兒，不如想清楚哪些值得深耕。"
---

新年第一週，適合做一次技術規劃。2020 年變化太多：Vue 3、Angular 11、webpack 5、Vite……與其追趕每一個新玩意兒，不如想清楚哪些值得深耕。

## 2020 年技術覆盤

過去一年影響最深的幾個變化：

**Vite 的出現**改變了開發體驗的預期。一旦用過秒級啟動，很難回去接受分鐘級等待。即使你的生產環境還在用 webpack，開發環境也值得考慮遷移。

**Vue 3 的 Composition API** 不只是 Vue 的特性，它和 React Hooks 共同確立了"邏輯複用用 hook/composable"的範式，替代了過去 mixin 和 HOC 的混亂地帶。

**TypeScript 滲透率** 已經到了"新專案不用需要解釋"的程度。2021 年關注點應該從"要不要用"轉向"怎麼用好"。

## 2021 年技術樹推薦

### 優先深耕（直接影響工作產出）

**TypeScript 進階**

```typescript
// 能寫這樣的型別工具函式的人，在 2021 年稀缺
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type ExtractRouteParams<T extends string> =
  T extends `${infer _}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _}:${infer Param}`
      ? { [K in Param]: string }
      : {};
```

**React 18 / Vue 3 深度**
不是學 API，是理解併發渲染、Suspense 資料載入、Composition API 的設計動機。

**效能工程化**
Core Web Vitals 進入 Google 排名演算法（2021 年 5 月），LCP/FID/CLS 從"錦上添花"變成"基礎要求"。

### 值得了解（擴寬技術視野）

**SSR / 元框架**：Next.js 10、Nuxt 3 beta、SvelteKit——服務端渲染從"高階玩法"變成了標配選項。

**測試**：Vitest（基於 Vite 的測試框架）、Playwright（跨瀏覽器 E2E）、Testing Library——測試工具鏈在 2021 年有顯著進步。

**邊緣計算**：Cloudflare Workers、Vercel Edge Functions——前端的執行邊界在擴充套件。

### 暫時觀望

**Deno**：雖然 1.0 已經發布，但生態仍不成熟，Node.js 生態的遷移成本遠大於收益。等 Deno 2.0 再看。

**WebAssembly**：除非你在做音影片處理或 3D 渲染，否則 2021 年還不是進入的好時機。

## 實操建議

**每週輸出節奏**（適合工作之餘）：

- 週一/三：閱讀一篇技術部落格並做筆記
- 週五：寫一小段驗證性程式碼
- 每月：完成一個小 Side Project，應用當月學的東西

**避免的陷阱**：

- 教程驅動學習（Tutorial Hell）：做完 10 個 To-Do App 不如參與一個真實專案
- 廣度優先：同時學 3 個框架不如把一個用到極致
- 忽視軟技能：程式碼審查、技術方案寫作，2021 年的技術成長少不了這些

## 我的 2021 重點

1. **TypeScript 體操**：把條件型別、模板字面量型別用熟
2. **效能最佳化**：系統學習 Core Web Vitals，給現有專案做一次全面體檢
3. **Vite 生態**：跟進 Vite 2.0 和 Vitest 的進展
4. **閱讀原始碼**：Vue 3 響應式系統 + React Fiber 核心部分

## 總結

技術的價值不在於數量，在於深度和應用。2021 年與其追趕每一個新框架，不如把當前技術棧用到極致，同時保持對新趨勢的關注——知道它在做什麼，以及什麼時候該切換。
