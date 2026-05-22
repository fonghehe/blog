---
title: "Angular 17 デフォルト esbuild ビルド：初回ビルド3倍高速化の実践まとめ"
date: 2024-01-10 16:06:34
tags:
  - Angular
  - Esbuild
readingTime: 3
description: "Angular 17 は2023年11月に正式リリースされました。その中でも開発体験に最も直接的な影響を与える改善点の1つは、esbuild をデフォルトビルダーに設定したことです。新しいプロジェクトでは設定不要で大幅に高速化されたビルド速度を享受でき、既存プロジェクトも1つのコマンドで移行が完了します。年始は棚卸しとアップグレードに最適なタイミングですので、この変更がもたらした実際の効果を見てみましょう。"
wordCount: 635
---

Angular 17 は2023年11月に正式リリースされました。その中でも開発体験に最も直接的な影響を与える改善の1つは、esbuild がデフォルトビルダーになったことです。新プロジェクトは設定不要で大幅に高速化されたビルドを利用でき、既存プロジェクトも1つのコマンドで移行できます。年始は棚卸しとアップグレードに最適な時期ですので、この変更がもたらした具体的な効果を見ていきましょう。

## 新旧ビルドシステムの比較

Angular 17 より前は、webpack ベースの `@angular-devkit/build-angular:browser` がデフォルトで使用されていました。Angular 17 からは、新規プロジェクトでは `@angular-devkit/build-angular:application`（内部は esbuild + Rollup ベース）がデフォルトになります：

```
実測データ（50コンポーネントの中規模プロジェクト）：

                    初回ビルド    インクリメンタルビルド（HMR）
webpack（旧）          ~45s         ~2-3s
esbuild（新）          ~12s        ~200-400ms

改善倍率               3.7x          ~8x
```

## angular.json 設定の変更

```json
// 新プロジェクトのデフォルト（Angular 17+）
{
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": "dist/my-app",
        "index": "src/index.html",
        "browser": "src/main.ts", // 注意：従来の "main" ではありません
        "polyfills": ["zone.js"],
        "assets": ["src/favicon.ico", "src/assets"],
        "styles": ["src/styles.css"],
        "scripts": []
      }
    },
    "serve": {
      "builder": "@angular-devkit/build-angular:dev-server"
      // dev-server は自動的に Vite + esbuild を使用
    }
  }
}
```

`browser` フィールドが従来の `main` を置き換えていることに注意してください。これは Angular 17 の新しいビルドシステムの命名規則です。

## 既存プロジェクトの移行

```bash
# ng update を使用して自動移行
ng update @angular/core@17 @angular/cli@17

# 移行後、ビルドを実行して確認
ng build

# 新しいビルダーに切り替わったか手動で確認
grep -A3 '"build"' angular.json | grep builder
# 出力："@angular-devkit/build-angular:application" となるはず
```

### 移行時のよくある問題

**1. カスタム webpack 設定は非サポート**

```typescript
// 旧方式：custom-webpack プラグインで拡張
// webpack.config.js は新しいビルダーでは使用不可

// 新方式：Vite プラグインまたは内蔵オプションで対応
// angular.json で define を設定し、webpack DefinePlugin の代わりとする
{
  "options": {
    "define": {
      "MY_GLOBAL_VAR": "\"production\""
    }
  }
}
```

**2. 出力ディレクトリ構造の変化**

```
旧出力（webpack）：
dist/my-app/
  main.js
  polyfills.js
  styles.css
  ...

新出力（esbuild）：
dist/my-app/
  browser/           // browser サブディレクトリが追加
    main-HASH.js
    polyfills-HASH.js
    styles-HASH.css
    ...
  server/            // SSR ファイル（有効な場合）
```

Nginx/Caddy などの静的ファイルサーバー設定のルートディレクトリパスを更新する必要があります。

## SSR統合の改善

Angular 17 の新しいビルドシステムは SSR と深く統合されています：

```bash
# 新規プロジェクト作成時に直接 SSR を有効化
ng new my-app --ssr

# 既存プロジェクトに SSR を追加
ng add @angular/ssr
```

```typescript
// server.ts（Angular 17 SSR 標準テンプレート）
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

新しい開発サーバーは Vite ベースで、真の HMR（ホットモジュールリプレイスメント）を実現します：

```bash
ng serve
# .ts ファイルの変更 → ~200ms で更新
# .html テンプレートの変更 → ~150ms で更新（Angular 17 からテンプレート HMR をサポート）
# .css/.scss の変更 → 即時注入、ページ更新なし
```

## まとめ

Angular 17 の esbuild デフォルト化は、実のある開発体験のアップグレードです。新規プロジェクトでは意識せずに恩恵を受けられ、既存プロジェクトでも `ng update` のワンクリック移行後、ビルド速度が3〜4倍に向上します。2024年に入り、まだ Angular 14/15 の webpack ビルドを使っているなら、17 へのアップグレードは最もコストパフォーマンスの高いエンジニアリング効率の改善の一つです。
