---
title: "Angular 17 預設 esbuild 構建：首次構建提速 3 倍的實踐總結"
date: 2024-01-10 16:06:34
tags:
  - Angular
  - Esbuild
readingTime: 2
description: "Angular 17 於 2023 年 11 月正式釋出，其中最直接影響開發體驗的改進之一是將 esbuild 設為預設構建器。新專案無需任何配置即可享受大幅加速的構建速度，老專案也只需一個命令完成遷移。年初正好是盤點和升級的好時機，來看看這個改變究竟帶來了多大的實質提升。"
---

Angular 17 於 2023 年 11 月正式釋出，其中最直接影響開發體驗的改進之一是將 esbuild 設為預設構建器。新專案無需任何配置即可享受大幅加速的構建速度，老專案也只需一個命令完成遷移。年初正好是盤點和升級的好時機，來看看這個改變究竟帶來了多大的實質提升。

## 新舊構建器對比

Angular 17 之前，預設使用基於 webpack 的 `@angular-devkit/build-angular:browser`。Angular 17 起，新專案預設使用 `@angular-devkit/build-angular:application`（內部基於 esbuild + Rollup）：

```
實測資料（50 個元件的中型專案）：

                    首次構建    增量構建（HMR）
webpack（舊）          ~45s         ~2-3s
esbuild（新）          ~12s        ~200-400ms

提升幅度               3.7x          ~8x
```

## angular.json 配置變化

```json
// 新專案預設（Angular 17+）
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

注意 `browser` 欄位替代了原來的 `main`，這是 Angular 17 新構建系統的命名約定。

## 遷移老專案

```bash
# 使用 ng update 自動遷移
ng update @angular/core@17 @angular/cli@17

# 遷移後，執行構建驗證
ng build

# 手動檢查是否已切換到新構建器
grep -A3 '"build"' angular.json | grep builder
# 應輸出："@angular-devkit/build-angular:application"
```

### 遷移常見問題

**1. 自定義 webpack 配置不再支援**

```typescript
// 舊方式：通過 custom-webpack 外掛擴充套件
// webpack.config.js 不再適用於新構建器

// 新方式：通過 Vite 外掛或內建選項
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
  server/            // SSR 檔案（如果開啟）
```

需要更新 Nginx/Caddy 等靜態檔案服務配置中的根目錄路徑。

## Server-Side Rendering 的整合改進

Angular 17 的新構建系統深度整合了 SSR：

```bash
# 建立新專案時直接開啟 SSR
ng new my-app --ssr

# 為現有專案新增 SSR
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

## 開發伺服器：Vite 驅動的 HMR

新的開發伺服器基於 Vite，帶來了真正的 HMR（熱模組替換）：

```bash
ng serve
# 修改 .ts 檔案 → ~200ms 內重新整理
# 修改 .html 模板 → ~150ms 內重新整理（Angular 17 開始支援模板 HMR）
# 修改 .css/.scss → 即時注入，不重新整理頁面
```

## 總結

Angular 17 的 esbuild 預設化是一次實實在在的開發體驗升級。對於新專案，無感受益；對於老專案，`ng update` 一鍵遷移後構建速度提升 3-4 倍。進入 2024 年，如果你還在用 Angular 14/15 的 webpack 構建，升級到 17 是價效比最高的工程效率改進之一。