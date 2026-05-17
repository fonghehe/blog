---
title: "Vue CLI 3 Beta：初体験"
date: 2018-06-07 10:24:17
tags:
  - Vue
readingTime: 2
description: "Vue CLI 3がBetaをリリースしました。以前のCLI 2とは大きく異なります。試用した感想を記録します。"
---

Vue CLI 3がBetaをリリースしました。以前のCLI 2とは大きく異なります。試用した感想を記録します。

## 最大の変化：ゼロ設定

CLI 2では`webpack.config.js`を手動でメンテナンスする必要がありましたが、ファイルが長くて分かりにくいものでした。CLI 3ではwebpackの設定を完全にカプセル化し、すぐに使える状態で提供しています：

```bash
npm install -g @vue/cli
vue create my-app
cd my-app
npm run serve
```

これだけです。webpackの設定を一切触る必要がありません。

## 設定方法：vue.config.js

カスタマイズが必要な場合は、プロジェクトのルートに`vue.config.js`を作成します：

```javascript
// vue.config.js
module.exports = {
  // 公開パス
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 開発サーバーのプロキシ
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  // webpack設定のマージ
  configureWebpack: {
    plugins: [new MyPlugin()],
  },

  // webpackのチェーン修正
  chainWebpack: (config) => {
    config.plugin("html").tap((args) => {
      args[0].title = "私のアプリ";
      return args;
    });
  },
};
```

## プラグインシステム

CLI 3の大きな特長はプラグイン化です。機能を追加するのに設定を手動で変更する必要はなく、プラグインをインストールするだけです：

```bash
vue add router      # Vue Routerを追加
vue add vuex        # Vuexを追加
vue add element-ui  # Element UIを追加
vue add pwa         # PWAサポートを追加
vue add typescript  # TypeScriptを追加
```

プラグインがプロジェクト構造と設定を自動的に変更してくれます。手動での変更は不要です。

## 環境変数

```bash
# .env.production
VUE_APP_API_URL=https://api.example.com
VUE_APP_VERSION=1.0.0
```

コード内では`process.env.VUE_APP_*`でアクセスできます（`VUE_APP_`プレフィックスのある変数のみクライアントに公開されます）。

## GUI インターフェース

CLI 3にはWebインターフェース（！）もあります：

```bash
vue ui
```

ブラウザを開くと、プラグインの管理、スクリプトの実行、ビルド分析の確認が画面上でできます。コマンドラインに慣れていない人にとても優しいです。

## CLI 2からの移行

現時点では自動移行ツールはありません。新プロジェクトにCLI 3を使用することを推奨します。旧プロジェクトは適切なタイミングになるまでCLI 2でメンテナンスを続け、その後移行することができます。

## まとめ

- ゼロ設定——webpackは完全にカプセル化され、手動メンテナンス不要
- `vue.config.js`が柔軟な設定エントリーポイントを提供
- `vue add`プラグインコマンドでワンステップで機能を統合
- GUIインターフェースは参入障壁を下げる目玉機能
