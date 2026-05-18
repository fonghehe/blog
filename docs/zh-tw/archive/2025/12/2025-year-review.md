---
title: "2025 年前端技術回顧：Signal 時代正式開啟"
date: 2025-12-31 10:00:00
tags:
  - 前端
readingTime: 2
description: "2025 年是前端技術\"從實驗到成熟\"的一年。React 20 Compiler 穩定、Angular 21 完成 Signal 化轉型、Vue Vapor Mode 落地、Rolldown 穩定進入生產、AI 程式設計工具從輔助變成協同開發的核心。站在 2025 年最後一天，來做一個全面的年度盤點。"
---

2025 年是前端技術"從實驗到成熟"的一年。React 20 Compiler 穩定、Angular 21 完成 Signal 化轉型、Vue Vapor Mode 落地、Rolldown 穩定進入生產、AI 程式設計工具從輔助變成協同開發的核心。站在 2025 年最後一天，來做一個全面的年度盤點。

## 年度關鍵詞：Signal 統治響應式

2025 年各大框架都走向了 Signal 驅動的響應式模型：

```
Signal 化程序年度總結（2025）：

Angular  → 21 版本完成全面 Signal 化（Forms、Queries、Zoneless 全穩定）
Vue      → Vapor Mode（無 VDOM + 原生 Signal）在 Vue 3.6 進入穩定預覽
Svelte   → Svelte 5 Runes（2024 釋出，2025 全面普及）
Solid    → 繼續在 Signal 領域領先，成為框架技術參考
Preact   → Preact Signals 成為 Preact 的推薦狀態管理
React    → 無原生 Signal，但 React Compiler 彌補了手動記憶化的痛點
```

## React 生態 2025 年度總結

```typescript
// 2025 年 React 技術棧的最佳組合
// React 20 + React Compiler + Server Actions + Suspense

// ① React Compiler（穩定版）：自動記憶化，徹底告別手寫 useMemo
function ProductList({ products, searchTerm }) {
  // Compiler 自動處理所有最佳化
  const filtered = products.filter(p => p.name.includes(searchTerm));
  return filtered.map(p => <ProductCard key={p.id} product={p} />);
}

// ② Server Actions（成熟）：表單和資料變更的一等公民
async function updateProduct(id: string, data: FormData) {
  'use server';
  await db.products.update({ where: { id }, data: Object.fromEntries(data) });
  revalidatePath('/products');
}

// ③ use() Hook：直接讀取 Promise（無需 useEffect + useState）
function AsyncProfile({ profilePromise }) {
  const profile = use(profilePromise);
  return <div>{profile.name}</div>;
}
```

## Angular 2025 年度總結

```
Angular 版本路線（2025年）：
19.1（1月） → linkedSignal 完善
19.2（2月） → Signal Forms 開發者預覽啟動
19.3（3月） → 增量水合穩定
20.0（5月） → Zoneless 穩定，Signal Forms 開發者預覽
20.1（7月） → httpResource API 完善
20.2（8月） → Signal Forms 深化
21 RC（10月）→ Signal Forms 將穩定
21.0（11月）→ Signal Forms 正式穩定，轉型完成 ✅
```

## 構建工具 2025 年度總結

```
工具              狀態變化                    主要貢獻
──────────────────────────────────────────────────────────
Rolldown          2025 年中穩定，Vite 7 整合  Rust 重寫 Rollup，構建快 10x+
oxc               oxlint 規則集完善至 80%+    替代 ESLint 的成熟方案
Vite 7            Rolldown 作為生產後端        構建速度革命
Turbopack         Next.js 16 生產預設          Next.js 生態獨佔
Farm              小眾但效能極佳               Rust 構建工具競爭者
```

## AI 輔助程式設計 2025 年度總結

```
2025 年 AI 程式設計工具的成熟標誌：

① 多檔案 Agent 編寫（Cursor、Windsurf、Claude Code）
  → 從"單檔案補全"到"功能模組生成"
  → 前端重複性工作（CRUD 頁面、表單元件）生產率提升 3-5x

② 測試生成自動化
  → 寫函式時 AI 同步生成測試用例
  → 單元測試覆蓋率維持 80% 的成本大幅降低

③ 程式碼 Review AI
  → 安全漏洞（XSS、CSRF）自動檢測
  → 效能反模式識別

④ 設計到程式碼
  → Figma MCP 整合 + AI 生成 → 元件質量達到可用水平
```

## 2025 年最值得關注的技術演進

```
1. CSS Anchor Positioning 全面可用（≥78% 支援）
   → Popper.js/Floating UI 對基礎場景不再必要

2. View Transitions v2（跨文件）
   → MPA 也能有 SPA 級別的頁面過渡動畫

3. HTML Popover + anchor() 組合
   → 純 HTML+CSS 實現大部分彈出層場景

4. JavaScript 新 API 大豐收
   → Iterator Helpers、Set.prototype.union 等進入 Baseline
   → Array.fromAsync、Promise.try 廣泛可用

5. TypeScript 5.8 erasableSyntaxOnly
   → 為 Node.js 原生 .ts 支援鋪路
```

## 展望 2026

```
最值得期待：
① React Native 新架構 + React 20 在移動端全面穩定
② Angular 22：Zoneless 全面普及，VDOM-less 探索
③ Vue Vapor Mode 正式穩定（無 VDOM 的 Vue 3）
④ Rolldown + oxc 工具鏈成熟（前端工具鏈 Rust 化完成）
⑤ CSS if()、CSS masonry layout 等草案進入 Baseline
⑥ AI Agent 開發從"輔助"到"協同"的分工更清晰
```

## 總結

2025 年前端的核心敘事是：**Signal 作為響應式原語統一了各大框架的設計語言**，構建工具完成了 Rust 化轉型，AI 程式設計工具達到了真正可用於日常工作的成熟度。對於前端開發者，2025 年的核心收穫是：熟悉了 Signal 模型（無論是 Angular/Vue/Svelte）、用上了 Compiler 級別的最佳化（React Compiler/Svelte 5）、並真正將 AI 工具融入了日常工作流。2026 年見。
