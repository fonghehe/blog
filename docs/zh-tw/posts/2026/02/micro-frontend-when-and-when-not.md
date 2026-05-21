---
title: "微前端的終點：什麼時候該拆，什麼時候不該拆"
date: 2026-02-12 10:00:00
tags:
  - 微前端
readingTime: 2
description: "這兩年幫好幾個團隊做過微前端的評估，有上馬的，有叫停的。想寫一篇清醒的文章。"
wordCount: 395
---

這兩年幫好幾個團隊做過微前端的評估，有上馬的，有叫停的。想寫一篇清醒的文章。

## 微前端是什麼

簡單說：把一個大型前端應用拆分成多個可以**獨立開發、獨立部署**的小應用，在執行時組合成一個整體。

```
傳統單體前端：
  一個 repo → 一次構建 → 一次部署

微前端：
  多個 repo → 各自構建 → 各自部署 → 執行時組合
```

## 微前端適合的場景

**場景一：多團隊協作，釋出衝突**

```
團隊 A 負責訂單系統，團隊 B 負責庫存系統
兩個團隊都在同一個 repo 裡改程式碼
釋出視窗衝突，互相 block
→ 拆分成微前端，各自獨立釋出
```

**場景二：遺留系統漸進遷移**

```
老系統是 jQuery，新系統是 React
不能一次性重寫（太大，太有風險）
→ 用微前端在新入口用 React，老功能用 jQuery
逐步替換
```

**場景三：技術棧多元化（有時）**

```
不同團隊有不同技術偏好
→ 這個理由很危險，容易導致技術債
只有當不同場景的技術需求確實不同時才成立
```

## 微前端不適合的場景

**團隊只有 1-3 人**

微前端引入的工程複雜度（路由協同、狀態共享、構建配置）遠超收益。

**產品還在早期，需求變化快**

拆分了邊界，需求變化時跨應用改動很痛苦。等業務穩定了再考慮。

**"別人在用，我們也要用"**

看到 qiankun、single-spa、Module Federation 就想上。沒想清楚解決什麼問題。

## 微前端的真實代價

```
1. 樣式隔離：各應用樣式不互相汙染，需要 CSS scope 策略
2. 狀態共享：使用者登入資訊、主題等需要跨應用共享
3. 路由協同：主應用路由 + 子應用路由如何配合
4. 構建複雜度：每個應用需要單獨的 CI/CD pipeline
5. 聯調困難：本地同時跑 N 個應用才能除錯
6. 效能：重複載入相同依賴（React 可能被載入多次）
```

**共享依賴問題的解決成本**往往超出預期。

## Module Federation 實踐

如果確定要用微前端，2025 年我會推薦 Webpack 5 Module Federation 或 Vite 的 federation 外掛：

```javascript
// host/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "host",
      remotes: {
        // 執行時載入遠端模組
        orderApp: "http://order.example.com/assets/remoteEntry.js",
        inventoryApp: "http://inventory.example.com/assets/remoteEntry.js",
      },
      shared: ["react", "react-dom"], // 共享依賴，避免重複載入
    }),
  ],
};
```

```javascript
// order-app/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "orderApp",
      filename: "remoteEntry.js",
      exposes: {
        "./OrderList": "./src/components/OrderList.tsx",
        "./OrderDetail": "./src/components/OrderDetail.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
};
```

```tsx
// host 裡使用遠端元件
import React, { lazy, Suspense } from "react";
const OrderList = lazy(() => import("orderApp/OrderList"));

function App() {
  return (
    <Suspense fallback={<div>載入訂單模組...</div>}>
      <OrderList />
    </Suspense>
  );
}
```

## 我的決策樹

```
有沒有獨立部署需求？
  ├── 沒有 → 不需要微前端
  └── 有 → 團隊規模多大？
            ├── < 5人 → 單體 + Nx monorepo 可能更好
            └── ≥ 5人，多個獨立團隊 → 繼續評估
                                        ↓
                               業務邊界是否清晰？
                               ├── 不清晰 → 先理清業務，再拆技術
                               └── 清晰 → 可以考慮微前端
                                            ↓
                                  拆分方案是否被詳細評估過？
                                  (路由、狀態、樣式、CI/CD 成本)
                                  ├── 沒有 → 先做評估
                                  └── 有且可接受 → 上
```

## 小結

- 微前端不是銀彈，它是用工程複雜度換部署獨立性
- 適合：多團隊協作、遺留遷移；不適合：小團隊、早期產品
- 上微前端前要想清楚樣式隔離、狀態共享、路由協同、CI/CD 成本
- Module Federation 是目前最成熟的方案
- 業務邊界清晰之前，先不要拆
