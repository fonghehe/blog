---
title: "Angular 17 默認 esbuild 構建：首次構建提速 3 倍的實踐總結"
date: 2024-01-10 16:06:34
tags:
  - Angular
  - Esbuild
readingTime: 2
description: "Angular 17 於 2023 年 11 月正式發佈，其中最直接影響開發體驗的改進之一是將 esbuild 設為默認構建器。新項目無需任何設定即可享受大幅加速的構建速度，老項目也隻需一個命令完成遷移。年初正好是盤點和升級的好時機，來看看這個改變究竟帶來了多大的實質提升。"
wordCount: 376
---

Angular 17 於 2023 年 11 月正式發佈，其中最直接影響開發體驗的改進之一是將 esbuild 設為默認構建器。新項目無需任何設定即可享受大幅加速的構建速度，老項目也隻需一個命令完成遷移。年初正好是盤點和升級的好時機，來看看這個改變究竟帶來了多大的實質提升。

## 新舊構建器對比

Angular 17 之前，默認使用基於 webpack 的 `@angular-devkit/build-angular:browser`。Angular 17 起，新項目默認使用 `@angular-devkit/build-angular:application`（內部基於 esbuild + Rollup）：

```
實測數據（50 個組件的中型項目）：

                    首次構建    增量構建（HMR）
webpack（舊）          ~45s         ~2-3s
esbuild（新）          ~12s        ~200-400ms

提升幅度               3.7x          ~8x
```

## angular.json 設定變化

```json
// 新項目默認（Angular 17+）
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": "dist/my-app",
        "index": "src/index.html",
        "browser": "src/main.ts", // 注意：不再是 "main"
        "polyfills": ["zone.js"],
        "assets": ["src/favicon.ico", "src/assets"],
        "styles": ["src/styles.css"],
        "scripts": []
      }
    },
    "serve": {
      "builder": "@angular-devkit/build-angular:dev-server"
      // dev-server 現在自動使用 Vite + esbuild
    }
  }
}
```

注意 `browser` 字段替代了原來的 `main`，這是 Angular 17 新構建系統的命名約定。

## 遷移老項目

```bash
# 使用 ng update 自動遷移
ng update @angular/core@17 @angular/cli@17

# 遷移後，運行構建驗證
ng build

# 手動檢查是否已切換到新構建器
grep -A3 '"build"' angular.json | grep builder
# 應輸出："@angular-devkit/build-angular:application"
```

### 遷移常見問題

**1. 自定義 webpack 配置不再支持**

```typescript
// 舊方式：通過 custom-webpack 插件擴展
// webpack.config.js 不再適用於新構建器

// 新方式：通過 Vite 插件或內置選項
// angular.json 中配置 define 替代 webpack DefinePlugin
{
  "options": {
    "define": {
      "MY_GLOBAL_VAR": "\"production\""
    }
  }
}
```

**2. 輸出目錄結構變化**

```
舊輸出（webpack）：
dist/my-app/
  main.js
  polyfills.js
  styles.css
  ...

新輸出（esbuild）：
dist/my-app/
  browser/           // 新增 browser 子目錄
    main-HASH.js
    polyfills-HASH.js
    styles-HASH.css
    ...
  server/            // SSR 文件（如果開啓）
```

需要更新 Nginx/Caddy 等靜態檔案服務設定中的根目錄路徑。

## Server-Side Rendering 的集成改進

Angular 17 的新構建系統深度整合了 SSR：

```bash
# 創建新項目時直接開啓 SSR
ng new my-app --ssr

# 為現有項目添加 SSR
ng add @angular/ssr
```

```typescript
// server.ts（Angular 17 SSR 標準模板）
import { APP_BASE_HREF } from "@angular/common";
import { CommonEngine } from "@angular/ssr";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import bootstrap from "./src/main.server";

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, "../browser");

  const commonEngine = new CommonEngine();

  server.get("*", (req, res, next) => {
    commonEngine
      .render({
        bootstrap,
        documentFilePath: join(browserDistFolder, "index.html"),
        url: `${req.protocol}://${req.headers.host}${req.originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}
```

## 開發服務器：Vite 驅動的 HMR

新的開發服務器基於 Vite，帶來了真正的 HMR（熱模塊替換）：

```bash
ng serve
# 修改 .ts 檔案 → ~200ms 內刷新
# 修改 .html 範本 → ~150ms 內刷新（Angular 17 開始支援範本 HMR）
# 修改 .css/.scss → 即時注入，不刷新頁面
```

## 總結

Angular 17 的 esbuild 默認化是一次實實在在的開發體驗升級。對於新項目，無感受益；對於老項目，`ng update` 一鍵遷移後構建速度提升 3-4 倍。進入 2024 年，如果你還在用 Angular 14/15 的 webpack 構建，升級到 17 是性價比最高的工程效率改進之一。