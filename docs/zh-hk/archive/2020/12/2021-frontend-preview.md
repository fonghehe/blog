---
title: "2021 前端技術展望：框架成熟期與工程化深水區"
date: 2020-12-31 09:35:56
tags:
  - 前端
readingTime: 2
description: "2020 年是前端歷史上變化最密集的年份之一：Vue 3 正式發佈、React 17 升級鋪路、Angular 保持季度發版節奏、Vite 顛覆開發體驗、webpack 5 發佈 Module Federation。站在 2020 年末，來聊聊 2021 年值得關注的方向。"
wordCount: 641
---

2020 年是前端歷史上變化最密集的年份之一：Vue 3 正式發佈、React 17 升級鋪路、Angular 保持季度發版節奏、Vite 顛覆開發體驗、webpack 5 發佈 Module Federation。站在 2020 年末，來聊聊 2021 年值得關注的方向。

## 框架進入穩定成熟期

### Vue 3 生態補全

Vue 3 於 2020 年 9 月發佈，但生態還不完整。2021 年預期：

- Vue Router 4 和 Pinia（Vuex 5）趨於穩定
- Nuxt 3（基於 Vue 3）發佈
- UI 庫（Element Plus、Ant Design Vue 3.x）相繼完善

### React Server Components

React 團隊在 2020 年底預覽了 Server Components——在服務端渲染組件，零客户端 JS。這可能是 React 近年來最大的架構變化：

```jsx
// Server Component（文件名 .server.js）
// 直接訪問數據庫，代碼不發送到瀏覽器
import db from "./db";

async function Notes() {
  const notes = await db.query("SELECT * FROM notes");
  return <NoteList notes={notes} />;
}
```

### Angular 12 預告

Angular 12 預計 2021 年 Q2 發佈，將正式刪除 View Engine，Ivy 成為唯一渲染引擎。Webpack 5 也會從實驗性轉為默認。

## 工程化進入深水區

### 微前端從概念落地

Module Federation（webpack 5）讓微前端從"需要框架支援"變成了"內置於構建工具"：

```javascript
// 2021 年微前端的標準方案將更清晰
// qiankun（基於 single-spa）vs Module Federation 的邊界會越來越明確
```

### Monorepo 工具成熟

Nx、Turborepo（Vercel，2020 年底發佈）的出現讓 Monorepo 管理更簡單。2021 年大型團隊採用 Monorepo 的比例將顯著上升。

### 構建速度軍備競賽

esbuild、SWC（Rust 寫的 JS 編譯器，Next.js 12 將採用）的出現預示着：**用系統語言（Go/Rust）重寫 JS 工具鏈**是 2021 年的主旋律。

## TypeScript 全面滲透

2020 年 State of JS 調查：TypeScript 滿意度 93%，使用率首次超過純 JavaScript。2021 年預期：

- 大型團隊新項目 100% TypeScript
- TypeScript 4.x 持續改進類型推斷和性能
- `ts-node` 與 Deno 讓服務端 TS 更主流

## 效能指標標準化

Google 的 Core Web Vitals（LCP、FID、CLS）將在 2021 年 5 月正式納入 Google 搜索排名算法。這意味着性能優化從"加分項"變成了"必選項"：

| 指標 | 含義         | Good 標準 |
| 
---- | ------------ | --------- |
| LCP  | 最大內容繪製 | ≤ 2.5s    |
| FID  | 首次輸入延遲 | ≤ 100ms   |
| CLS  | 累計佈局偏移 | ≤ 0.1     |

## 個人學習路線建議

**深耕方向**（選一個）：

- Vue 3 + Composition API + Pinia（全套 Vue 生態）
- React + React Query + Zustand/Jotai（現代 React 狀態管理）
- Angular + RxJS + NgRx（企業級方向）

**橫向能力**：

- TypeScript 泛型和高級類型
- webpack 5 / Vite 配置調優
- 性能優化：Core Web Vitals 指標體系

## 總結

2021 年前端的關鍵詞是**成熟與深化**——框架本身不會有顛覆性變化，但工程化、性能、TypeScript 這幾個方向會持續深入。與其追新框架，不如把現有技術棧用到極致。
