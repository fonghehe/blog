---
title: "Angular 17 デフォルト esbuild ビルド：初回ビルド3倍高速化の実践まとめ"
date: 2024-01-10 16:06:34
tags:
  - Angular
  - Esbuild
readingTime: 2
description: "Angular 17 于 2023 年 11 月正式发布，其中最直接影响开发体验的改进之一是将 esbuild 设为默认构建器。新项目无需任何配置即可享受大幅加速的构建速度，老项目也只需一个命令完成迁移。年初正好是盘点和升级的好时机，来看看这个改变究竟带来了多大的实质提升。"
wordCount: 388
---

Angular 17 于 2023 年 11 月正式发布，其中最直接影响开发体验的改进之一是将 esbuild 设为默认构建器。新项目无需任何配置即可享受大幅加速的构建速度，老项目也只需一个命令完成迁移。年初正好是盘点和升级的好时机，来看看这个改变究竟带来了多大的实质提升。

## 新旧ビルドシステムの比較

Angular 17 之前，默认使用基于 webpack 的 `@angular-devkit/build-angular:browser`。Angular 17 起，新项目默认使用 `@angular-devkit/build-angular:application`（内部基于 esbuild + Rollup）：

```
实测数据（50 个组件的中型项目）：

                    首次构建    增量构建（HMR）
webpack（旧）          ~45s         ~2-3s
esbuild（新）          ~12s        ~200-400ms

提升幅度               3.7x          ~8x
```

## angular.json 設定の変更

```json
// 新项目默认（Angular 17+）
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
      // dev-server 现在自动使用 Vite + esbuild
    }
  }
}
```

注意 `browser` 字段替代了原来的 `main`，这是 Angular 17 新构建系统的命名约定。

## 既存プロジェクトの移行

```bash
# 使用 ng update 自动迁移
ng update @angular/core@17 @angular/cli@17

# 迁移后，运行构建验证
ng build

# 手动检查是否已切换到新构建器
grep -A3 '"build"' angular.json | grep builder
# 应输出："@angular-devkit/build-angular:application"
```

### 迁移常见问题

**1. 自定义 webpack 配置不再支持**

```typescript
// 旧方式：通过 custom-webpack 插件扩展
// webpack.config.js 不再适用于新构建器

// 新方式：通过 Vite 插件或内置选项
// angular.json 中配置 define 替代 webpack DefinePlugin
{
  "options": {
    "define": {
      "MY_GLOBAL_VAR": "\"production\""
    }
  }
}
```

**2. 输出目录结构变化**

```
旧输出（webpack）：
dist/my-app/
  main.js
  polyfills.js
  styles.css
  ...

新输出（esbuild）：
dist/my-app/
  browser/           // 新增 browser 子目录
    main-HASH.js
    polyfills-HASH.js
    styles-HASH.css
    ...
  server/            // SSR 文件（如果开启）
```

需要更新 Nginx/Caddy 等静态文件服务配置中的根目录路径。

## SSR統合の改善

Angular 17 的新构建系统深度整合了 SSR：

```bash
# 创建新项目时直接开启 SSR
ng new my-app --ssr

# 为现有项目添加 SSR
ng add @angular/ssr
```

```typescript
// server.ts（Angular 17 SSR 标准模板）
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

## 開発サーバー：Vite駆動のHMR

新的开发服务器基于 Vite，带来了真正的 HMR（热模块替换）：

```bash
ng serve
# 修改 .ts 文件 → ~200ms 内刷新
# 修改 .html 模板 → ~150ms 内刷新（Angular 17 开始支持模板 HMR）
# 修改 .css/.scss → 即时注入，不刷新页面
```

## まとめ

Angular 17 的 esbuild 默认化是一次实实在在的开发体验升级。对于新项目，无感受益；对于老项目，`ng update` 一键迁移后构建速度提升 3-4 倍。进入 2024 年，如果你还在用 Angular 14/15 的 webpack 构建，升级到 17 是性价比最高的工程效率改进之一。