---
title: "2019 前端技術趨勢預測"
date: 2018-12-22 17:40:50
tags:
  - 前端
readingTime: 2
description: "2018 年即將結束，來預測一下 2019 年的前端走向。"
---

2018 年即將結束，來預測一下 2019 年的前端走向。

## React Hooks 正式版

這是 2019 年最確定會發生的事之一。Hooks 在 2018 年 React Conf 亮相，API 基本穩定，2019 年初會正式發佈（隨 React 16.8）。

預測：

- Hooks 會快速替代 HOC 和 render props 成為主流
- 大量現有庫會推出 Hooks 版本（react-query、SWR 等）
- 函數組件成為默認寫法，class 組件會慢慢減少

## Vue 3.0 進入實質性開發

2018 年底尤雨溪已經透露了 Vue 3 的方向：

- Composition API（借鑑 React Hooks 的思路）
- 基於 Proxy 的響應式（解決 Vue 2 的已知限制）
- 更好的 TypeScript 支持
- 更小的體積（Tree Shaking 更徹底）

2019 年應該會有 Alpha 版本，但正式版可能要到 2020 年。

## TypeScript 繼續普及

2018 年 TypeScript 已經很流行了，2019 年預計：

- 更多開源庫提供一等 TypeScript 支持
- 團隊越來越難拒絕 TS（入職要求會出現 TS）
- TypeScript 4.x 的高級類型更實用

## 構建工具：競爭加劇

Webpack 4 已經足夠快，但還有幾個新玩家值得關注：

- **Parcel**：零配置，適合小項目
- **Rollup**：庫的打包首選
- **Snowpack（早期雛形）**：基於 ESM 的開發服務器概念

預測 2019 年不會有顛覆性變化，Webpack 仍是主流。

## 微前端從概念到落地

2018 年微前端主要在討論層面，2019 年會有更多實際落地案例。single-spa 會繼續成熟，國內會出現更多中文實踐文章。

## 小程序生態繼續擴張

微信小程序、支付寶小程序、字節跳動小程序都在發展。跨平台小程序框架（uni-app、Taro）會繼續改進。前端要會寫小程序越來越重要。

## 漸進式 Web App（PWA）

PWA 在國內的普及比預想慢，主要原因是 iOS Safari 對 Service Worker 的支持不完整（2018 年已改善）。2019 年隨着 iOS 12 普及，PWA 可能會有新一輪熱潮。

## AI 輔助編程

GitHub Copilot 等工具還沒出現，但 2019 年會有更多關於 AI 輔助代碼生成的討論。不過大規模應用可能還要幾年。

## 我的個人計劃

- **深入 React**：Hooks 出了就係統學，搞懂 Concurrent Mode 的原理
- **Vue 3**：跟進 Alpha 版本，做技術儲備
- **TypeScript**：把現有項目遷移，實踐高級類型
- **Node.js**：學會用 Node 解決工程化問題，不只是寫 API
- **計算機基礎**：讀《CSAPP》、刷 LeetCode，補齊短板

2019，繼續努力。
