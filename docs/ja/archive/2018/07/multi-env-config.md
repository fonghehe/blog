---
title: "フロントエンドエンジニアリング：マルチ環境設定管理"
date: 2018-07-17 15:05:37
tags:
  - フロントエンド
readingTime: 2
description: "プロジェクトは通常、development、staging、productionの3つの環境があり、それぞれAPIアドレスやフィーチャーフラグなどの設定が異なります。この記事ではマルチ環境設定のベストプラクティスをまとめます。"
---

プロジェクトは通常、development、staging、productionの3つの環境があり、それぞれAPIアドレスやフィーチャーフラグなどの設定が異なります。この記事ではマルチ環境設定のベストプラクティスをまとめます。

## 環境変数の基礎

### Vue CLI 3の方法（推奨）

Vue CLI 3にはdotenvのサポートが組み込まれており、`.env.*`ファイルを読み込みます：

```
.env                  すべての環境で読み込まれる
.env.local            すべての環境で読み込まれるが、gitにコミットしない（ローカル上書き用）
.env.development      development環境
.env.staging          staging環境（カスタム）
.env.production       production環境
```

```bash
# .env.development
VUE_APP_API_BASE=http://localhost:3000
VUE_APP_ENV=development
VUE_APP_DEBUG=true

# .env.staging
VUE_APP_API_BASE=https://api.staging.example.com
VUE_APP_ENV=staging
VUE_APP_DEBUG=false

# .env.production
VUE_APP_API_BASE=https://api.example.com
VUE_APP_ENV=production
VUE_APP_DEBUG=false
```

**注意：`VUE_APP_`プレフィックスで始まる変数のみクライアントコードに注入されます。**

```javascript
// コード内での使用
const apiBase = process.env.VUE_APP_API_BASE;
const isDebug = process.env.VUE_APP_DEBUG === "true";
```

### 特定の環境で実行する

```json
{
  "scripts": {
    "serve": "vue-cli-service serve",
    "serve:staging": "vue-cli-service serve --mode staging",
    "build": "vue-cli-service build",
    "build:staging": "vue-cli-service build --mode staging",
    "build:production": "vue-cli-service build --mode production"
  }
}
```

## マルチ環境設定の構造

```javascript
// src/config/index.js
const envConfigs = {
  development: {
    apiBase: process.env.VUE_APP_API_BASE,
    uploadUrl: "http://localhost:3000/upload",
    wsUrl: "ws://localhost:3001",
    features: {
      debugPanel: true,
      mockData: true,
    },
  },
  staging: {
    apiBase: process.env.VUE_APP_API_BASE,
    uploadUrl: "https://upload.staging.example.com",
    wsUrl: "wss://ws.staging.example.com",
    features: {
      debugPanel: true,
      mockData: false,
    },
  },
  production: {
    apiBase: process.env.VUE_APP_API_BASE,
    uploadUrl: "https://upload.example.com",
    wsUrl: "wss://ws.example.com",
    features: {
      debugPanel: false,
      mockData: false,
    },
  },
};

const env = process.env.VUE_APP_ENV || "development";
export default envConfigs[env];
```

```javascript
// 使用例
import config from "@/config";

axios.defaults.baseURL = config.apiBase;

if (config.features.debugPanel) {
  // デバッグパネルを表示
}
```

## 機密情報の扱い

**シークレットキーは絶対にクライアントコードに置かないでください：**

```bash
# ❌ たとえ.envファイルでもこれはNG
VUE_APP_STRIPE_SECRET_KEY=sk_live_xxxxx  # JSにバンドルされてしまう！
VUE_APP_DB_PASSWORD=xxxxx

# ✅ 公開可能な設定のみ
VUE_APP_STRIPE_PUBLIC_KEY=pk_live_xxxxx  # 公開可能キー
VUE_APP_API_BASE=https://api.example.com
```

機密情報（APIシークレット、データベースパスワード）は**サーバーサイド**の環境変数にのみ置いてください。

## .envファイルのGit管理

```ini
# .gitignore
.env.local
.env.*.local

# これらはコミット可能（機密情報を含まない場合）：
# .env
# .env.development
# .env.staging
# .env.production
```

サンプルファイルを用意して、新しいメンバーが必要な変数を把握できるようにしましょう：

```bash
# .env.example（gitにコミットする）
VUE_APP_API_BASE=          # APIアドレスを入力してください
VUE_APP_ENV=development
VUE_APP_SENTRY_DSN=        # 任意：Sentry DSN
```

## ビルド時の設定の違い

特定の環境のビルドにのみ必要な設定があります：

```javascript
// vue.config.js
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  productionSourceMap: false, // 本番環境ではソースマップを生成しない（セキュリティ）

  chainWebpack: (config) => {
    if (isProduction) {
      // 本番環境ではSentryにソースマップをアップロード
      config.plugin("sentry").use(SentryWebpackPlugin, [
        {
          release: process.env.APP_VERSION,
        },
      ]);
    }
  },

  configureWebpack: {
    // 本番環境ではCDN externalsを使用
    externals: isProduction
      ? {
          vue: "Vue",
          "element-ui": "ELEMENT",
        }
      : {},
  },
};
```

## CI/CDでの環境変数

CI/CDプラットフォーム（GitLab CI、Jenkins）で機密変数を設定します：

```yaml
# .gitlab-ci.yml
build_staging:
  stage: build
  script:
    - npm ci
    - npm run build:staging
  variables:
    VUE_APP_SENTRY_DSN: $STAGING_SENTRY_DSN # CIプラットフォームのシークレットを参照
  environment:
    name: staging
```
