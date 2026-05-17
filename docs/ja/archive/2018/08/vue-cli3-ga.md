---
title: "Vue CLI 3 正式版：詳細使用ガイド"
date: 2018-08-11 10:57:54
tags:
  - Vue
readingTime: 2
description: "Vue CLI 3.0正式版（GA）がリリースされ、Betaから正式に卒業しました。Betaより大幅に安定し、プロダクションプロジェクトで使用できます。"
---

Vue CLI 3.0正式版（GA）がリリースされ、Betaから正式に卒業しました。Betaより大幅に安定し、プロダクションプロジェクトで使用できます。

## プロジェクト構造の比較

```
CLI 2のプロジェクト構造：
├── build/                  ← webpack設定ファイル
│   ├── webpack.base.conf.js
│   ├── webpack.dev.conf.js
│   └── webpack.prod.conf.js
├── config/                 ← 環境変数設定
├── src/
└── package.json

CLI 3のプロジェクト構造：
├── src/
├── public/                 ← webpackを通さない静的リソース
├── vue.config.js           ← オプション、すべての設定はこの1ファイルに
└── package.json
```

webpack設定が完全に内部化され、プロジェクトディレクトリがすっきりしました。

## vue.config.jsの完全な例

```javascript
const path = require("path");

module.exports = {
  // デプロイパス
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 出力ディレクトリ
  outputDir: "dist",

  // 静的リソースディレクトリ（outputDirからの相対パス）
  assetsDir: "static",

  // 開発サーバー
  devServer: {
    port: 8080,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },

  // CSS関連
  css: {
    loaderOptions: {
      sass: {
        // 変数をグローバルに注入、各vueファイルで手動importが不要
        prependData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // webpack設定の変更
  chainWebpack: (config) => {
    // html-webpack-pluginの設定を変更
    config.plugin("html").tap((args) => {
      args[0].title = "マイアプリ";
      return args;
    });

    // パスエイリアスを追加
    config.resolve.alias
      .set("@", path.resolve(__dirname, "src"))
      .set("components", path.resolve(__dirname, "src/components"));
  },

  configureWebpack: {
    // 直接マージするwebpack設定
    performance: {
      hints: process.env.NODE_ENV === "production" ? "warning" : false,
    },
  },
};
```

## 環境変数

```bash
# .env                   # すべての環境
# .env.local             # ローカル、gitにコミットしない
# .env.development       # 開発環境
# .env.production        # 本番環境

VUE_APP_API_URL=https://api.example.com
VUE_APP_TITLE=My App
```

コード内：`process.env.VUE_APP_API_URL`

## マルチページ設定

```javascript
module.exports = {
  pages: {
    index: {
      entry: "src/main.js",
      template: "public/index.html",
      filename: "index.html",
      title: "ホーム",
    },
    admin: {
      entry: "src/admin/main.js",
      template: "public/admin.html",
      filename: "admin.html",
      title: "管理画面",
    },
  },
};
```

## プラグイン開発

CLI 3のプラグインシステムは強力で、カスタムプラグインでwebpackの変更、ファイルの生成、コマンドの追加ができます：

```javascript
// vue-cli-plugin-my-plugin/index.js
module.exports = (api, options) => {
  api.extendPackage({
    dependencies: { lodash: "^4.0.0" },
  });

  api.chainWebpack((config) => {
    // webpack設定を変更
  });

  api.registerCommand("my-command", async () => {
    console.log("カスタムコマンドを実行");
  });
};
```

## まとめ

- CLI 3 GAはプロダクションで安全に使用できる
- `vue.config.js`ですべての設定を一元管理、webpackファイルの維持より簡単
- CSS `prependData`で変数をグローバルに注入、各コンポーネントでの手動importが不要
- マルチページ設定が非常にシンプル
