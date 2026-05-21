---
title: "Vite 開發服務器原理：基於 ESM 的極速熱更新"
date: 2020-05-09 17:09:28
tags:
  - 工程化
readingTime: 2
description: "Vite 1.0 在 2020 年發佈後，\"秒級啓動\"讓很多人驚歎。本文深入分析 Vite 能做到這一點的底層原理，以及它和 webpack dev server 的根本區別。"
wordCount: 428
---

Vite 1.0 在 2020 年發佈後，"秒級啓動"讓很多人驚歎。本文深入分析 Vite 能做到這一點的底層原理，以及它和 webpack dev server 的根本區別。

## 傳統 webpack 的瓶頸

webpack 在啓動時必須**先打包再服務**：

```
啓動 webpack dev server：
1. 解析所有入口和依賴樹（可能幾千個模塊）
2. 轉換每個模塊（TS→JS、Less→CSS 等）
3. 將所有模塊打包成 bundle
4. 啓動 HTTP 服務，提供 bundle
→ 冷啓動時間：幾十秒到幾分鐘（大型項目）
```

這意味着你改一個文件，webpack 需要重新構建受影響的整個 chunk，然後通過 WebSocket 發送更新。

## Vite 的 No-bundle 方案

```
啓動 Vite dev server：
1. 僅預構建 node_modules 中的依賴（esbuild，極快）
2. 啓動 HTTP 服務
→ 冷啓動時間：< 1 秒

瀏覽器請求頁面時：
按需轉換被請求的模塊（而不是提前打包所有模塊）
```

這依賴於現代瀏覽器原生支持 ES Module：

```html
<!-- index.html -->
<script type="module" src="/src/main.ts"></script>
```

瀏覽器看到 `type="module"` 後，會自行解析 `import` 語句併發起請求。Vite 只需要在服務端轉換被請求的文件：

```javascript
// 瀏覽器請求 /src/App.vue
// Vite 服務端接收請求，實時轉換：
// 1. 解析 .vue 文件的 template、script、style
// 2. 將 template 編譯成 render function
// 3. 返回 ES module 格式的 JS
```

## 依賴預構建

`node_modules` 中的包通常是 CommonJS 格式，瀏覽器不能直接 `import`。Vite 在首次啓動時用 **esbuild** 預構建這些依賴：

```
# Vite 啓動時的預構建
node_modules/lodash-es → .vite/lodash-es.js  （合併成單文件，減少請求數）
node_modules/vue       → .vite/vue.js
...
```

esbuild 是 Go 語言編寫的打包工具，速度比 webpack 快 10-100 倍，所以這個步驟通常在幾百毫秒內完成。

## HMR 實現原理

Vite 的 HMR 比 webpack 更精準：

```javascript
// Vite HMR 協議
// 當 src/components/Button.vue 被修改時：
// 1. Vite 文件監聽器檢測到變化
// 2. 分析該文件的 HMR 邊界
// 3. 僅使這個文件的模塊緩存失效
// 4. 通過 WebSocket 通知瀏覽器
// 5. 瀏覽器重新請求這個文件（而不是整個 bundle）

// 組件內接收 HMR
if (import.meta.hot) {
  import.meta.hot.accept("./Button.vue", (newModule) => {
    // 替換模塊
  });
}
```

Vue 和 React 的 HMR 插件（`@vitejs/plugin-vue`、`@vitejs/plugin-react`）自動處理組件級熱更新，開發者通常不需要手寫上面的代碼。

## 與 webpack 的對比

|            | webpack dev server     | Vite           |
| 
---------- | ---------------------- | -------------- |
| 冷啓動     | 慢（需要打包所有模塊） | 快（按需轉換） |
| HMR 速度   | 毫秒~秒（依項目大小）  | 始終毫秒級     |
| 生產構建   | webpack                | Rollup         |
| 配置複雜度 | 高                     | 低             |
| 兼容性     | IE11+                  | 現代瀏覽器     |

## vite.config.js 基礎配置

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: { "@": "/src" },
  },
});
```

## 總結

Vite 的快不是優化了 webpack，而是**繞過了打包這一步**。利用瀏覽器原生 ESM + esbuild 預構建，將"先打包再服務"變成了"按需轉換"。這個思路對於理解下一代前端工具鏈非常重要。
