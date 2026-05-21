---
title: "Vite 3.0 發佈：ESM 原生、全新 CLI 與更好的 SSR"
date: 2022-07-20 17:22:12
tags:
  - Vite
readingTime: 2
description: "Vite 3.0 於 2022 年 7 月 13 日正式發佈。距離 Vite 2.0 發佈已經過去了 16 個月，這次版本號升級帶來了一系列重要改進：基於 Rollup 3 的構建、統一的 dev/build 行為、改善的 SSR 支持，以及更清晰的 CLI 輸出。"
wordCount: 316
---

Vite 3.0 於 2022 年 7 月 13 日正式發佈。距離 Vite 2.0 發佈已經過去了 16 個月，這次版本號升級帶來了一系列重要改進：基於 Rollup 3 的構建、統一的 dev/build 行為、改善的 SSR 支持，以及更清晰的 CLI 輸出。

## 主要變化：不再支持舊版 Node.js

```bash
# Vite 3 要求 Node.js 14.18+（以前是 12.x）
node --version  # 確保 >= 14.18

# 升級 Vite
npm install vite@3
```

## 開發服務器默認端口變化

```bash
# Vite 2.x 默認端口
# → http://localhost:3000

# Vite 3.x 默認端口變為 5173
# → http://localhost:5173

# 避免與其他常見開發服務器（如 Express 的 3000）衝突
```

自定義端口：

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000, // 恢復到 3000（如果需要）
    strictPort: true, // 端口被佔用時直接報錯，不自動遞增
  },
  preview: {
    port: 8080, // vite preview 的端口也可以單獨配置
  },
});
```

## 構建改進：基於 Rollup 3

Vite 3 升級到 Rollup 3（從 2.x），帶來的主要改進：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // Rollup 3 的 target 默認從 es2019 → es2020
    target: "es2020",

    // 新增：模塊預加載 polyfill 可以關閉（現代瀏覽器不需要）
    modulePreload: {
      polyfill: false, // 減小 bundle 體積
    },

    rollupOptions: {
      output: {
        // Rollup 3 的手動分包更精確
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // 按頂級包名分包
            const pkg = id.split("node_modules/")[1].split("/")[0];
            return `vendor-${pkg}`;
          }
        },
      },
    },
  },
});
```

## 統一的 dev/build 行為

Vite 2.x 存在一個經典問題：開發環境（ESM dev server）和生產構建（Rollup）行為不一致，導致"dev 正常、build 報錯"的問題。Vite 3 通過統一處理方式減少了這類差異。

**資源導入行為統一**：

```javascript
// Vite 3 中，這兩種環境的資源導入行為更接近
import logo from "./assets/logo.svg?url"; // 明確請求 URL
import logoContent from "./assets/logo.svg?raw"; // 明確請求內容

// 不再依賴隱式行為判斷是否處理為 data URI 或 URL
```

## SSR 改進

```typescript
// vite.config.ts - SSR 相關改進
export default defineConfig({
  ssr: {
    // Vite 3 的 noExternal 支持正則表達式
    noExternal: [/^@my-org\//], // 所有 @my-org 開頭的包都被打包進 SSR

    // 新增：target 可以指定 SSR 構建目標
    target: "node", // 或 'webworker'（用於 Edge Runtime）
  },
  build: {
    ssr: true, // 生產 SSR 構建
  },
});
```

## CLI 輸出優化

Vite 3 的構建輸出更清晰：

```
# Vite 2.x 輸出（信息密集，難以區分重要信息）
dist/assets/index.d59c0a4e.js           148.34 KiB / gzip: 47.35 KiB
dist/assets/vendor.ce422158.js          231.03 KiB / gzip: 72.27 KiB

# Vite 3.x 輸出（更分層，大文件有警告）
dist/index.html                    0.45 kB
dist/assets/index-d59c0a4e.js    148.34 kB │ gzip: 47.35 kB
dist/assets/vendor-ce422158.js   231.03 kB │ gzip: 72.27 kB

(!) Some chunks are larger than 500 kB after minification.
Consider code-splitting or using dynamic import() to improve performance.
```

## 升級遷移

```bash
# 升級依賴
npm install vite@3 @vitejs/plugin-vue@3  # 或 @vitejs/plugin-react@2

# 主要 breaking changes 檢查：
# 1. 默認端口 3000 → 5173
# 2. import.meta.glob() 默認變為懶加載（可加 eager: true 恢復）
# 3. 部分 SSR 相關 API 重命名
```

**`import.meta.glob` 變化**：

```javascript
// Vite 2：默認 eager（同步）
const modules = import.meta.glob("./modules/*.ts");

// Vite 3：默認 lazy（異步）需要 await
const modules = import.meta.glob("./modules/*.ts");
// modules 現在是 () => Promise<...> 格式

// 如果需要舊行為（同步加載）：
const modules = import.meta.glob("./modules/*.ts", { eager: true });
```

## 總結

Vite 3 是一個穩步成熟的版本，沒有顛覆性變化，但在細節上做了大量打磨。基於 Rollup 3 的構建更可靠，SSR 支持更完善，dev/build 行為統一減少了環境一致性問題。對於已經在用 Vite 2 的項目，升級代價很小，值得跟進。