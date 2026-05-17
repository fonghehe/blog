---
title: "Webpackのマルチ環境変数設定"
date: 2018-05-17 15:30:37
tags:
  - Webpack
readingTime: 2
description: "プロジェクトには開発・テスト・本番の3つの環境があり、APIのアドレスが異なり、ログレベルも違い、機能フラグも異なります。これらの設定をどのように優雅に管理するか？"
---

プロジェクトには開発・テスト・本番の3つの環境があり、APIのアドレスが異なり、ログレベルも違い、機能フラグも異なります。これらの設定をどのように優雅に管理するか？

## 方法1：.envファイル（dotenvと組み合わせ）

```
.env                # すべての環境で共有する基本変数
.env.development    # 開発環境
.env.test           # テスト環境
.env.production     # 本番環境
```

```bash
# .env
APP_NAME=マイアプリ

# .env.development
API_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# .env.production
API_BASE_URL=https://api.example.com
LOG_LEVEL=error
```

Vue CLIプロジェクトはこれらのファイルを自動で読み込みます。`VUE_APP_`プレフィックスの変数はコードに注入されます：

```bash
# .env.development
VUE_APP_API_URL=http://localhost:3000
```

```javascript
// コード内での使用
const baseURL = process.env.VUE_APP_API_URL;
```

## 方法2：Webpack DefinePlugin

Vue CLIを使わないプロジェクトでは、`DefinePlugin`で変数を注入します：

```javascript
// webpack.config.js
const webpack = require("webpack");

const ENV = process.env.NODE_ENV || "development";
const envConfig = require(`./config/${ENV}.js`);

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(ENV),
      "process.env.API_URL": JSON.stringify(envConfig.apiUrl),
      __DEV__: ENV === "development",
    }),
  ],
};
```

```javascript
// config/development.js
module.exports = {
  apiUrl: "http://localhost:3000",
  enableDevtools: true,
};

// config/production.js
module.exports = {
  apiUrl: "https://api.example.com",
  enableDevtools: false,
};
```

## 方法3：複数のWebpack設定ファイル

```
webpack.common.js     # 共通設定
webpack.dev.js        # 開発環境設定
webpack.prod.js       # 本番環境設定
```

```javascript
// webpack.common.js
const path = require("path");
module.exports = {
  entry: "./src/index.js",
  output: { path: path.resolve(__dirname, "dist") },
};

// webpack.dev.js
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  devServer: { port: 8080 },
});

// webpack.prod.js
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "production",
  optimization: { minimize: true },
});
```

```json
// package.json
{
  "scripts": {
    "dev": "webpack --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js",
    "build:test": "NODE_ENV=test webpack --config webpack.prod.js"
  }
}
```

## コード内での環境変数の使用

```javascript
// api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 10000,
});

// 開発環境ではリクエストログを出力
if (process.env.NODE_ENV === "development") {
  api.interceptors.request.use((config) => {
    console.log("[API Request]", config.method?.toUpperCase(), config.url);
    return config;
  });
}

export default api;
```

## セキュリティの注意事項

```
❌ フロントエンドの環境変数に入れてはいけないもの：
  - データベースパスワード
  - APIキー（権限のあるもの）
  - 秘密鍵

✅ 入れても良いもの：
  - APIのベースURL
  - 機能フラグ
  - 公開サードパーティサービスのID（地図サービスのキー・アナリティクスIDなど）
```

フロントエンドのバンドルされたJSコードは誰でも閲覧できます。

## まとめ

- Vue CLIプロジェクト：`VUE_APP_`プレフィックス付きの`.env.*`ファイルを使用
- カスタムWebpack：`DefinePlugin` + 複数の設定ファイルを使用
- `webpack-merge`で設定をマージして重複を避ける
- 機密情報はフロントエンドの環境変数に含めない
