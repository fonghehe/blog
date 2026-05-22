---
title: "前端工程化：多環境設定管理"
date: 2018-07-17 15:05:37
tags:
  - 前端
readingTime: 2
description: "項目通常有 development、staging、production 三個環境，各有不同的 API 地址、Feature Flag 等設定。這篇文章整理多環境設定的最佳實踐。"
wordCount: 291
---

項目通常有 development、staging、production 三個環境，各有不同的 API 地址、Feature Flag 等配置。這篇文章整理多環境配置的最佳實踐。

## 環境變量基礎

### Vue CLI 3 的方式（推薦）

Vue CLI 3 內置了 dotenv 支持，讀取 `.env.*` 文件：

```
.env                  所有環境都加載
.env.local            所有環境加載，但不提交 git（用於本地覆蓋）
.env.development      development 環境
.env.staging          staging 環境（自定義）
.env.production       production 環境
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

**注意：以 `VUE_APP_` 開頭的變量才會被注入到客户端代碼。**

```javascript
// 在代碼裏使用
const apiBase = process.env.VUE_APP_API_BASE;
const isDebug = process.env.VUE_APP_DEBUG === "true";
```

### 運行指定環境

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

## 多環境的設定結構

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
// 使用
import config from "@/config";

axios.defaults.baseURL = config.apiBase;

if (config.features.debugPanel) {
  // 顯示調試面板
}
```

## 敏感信息處理

**永遠不要把密鑰放在客户端代碼裏：**

```bash
# ❌ 不要這樣做，即使在 .env 檔案裏
VUE_APP_STRIPE_SECRET_KEY=sk_live_xxxxx  # 會被打包進 JS！
VUE_APP_DB_PASSWORD=xxxxx

# ✅ 隻放公開設定
VUE_APP_STRIPE_PUBLIC_KEY=pk_live_xxxxx  # publishable key 是可以公開的
VUE_APP_API_BASE=https://api.example.com
```

私密信息（API secret、數據庫密碼）隻放在**服務端**的環境變量裏。

## .env 檔案的 Git 管理

```ini
# .gitignore
.env.local
.env.*.local

# 這些可以提交，但不包含敏感信息
# .env
# .env.development
# .env.staging
# .env.production
```

提供示例檔案，讓新同學知道需要哪些變量：

```bash
# .env.example（提交到 git）
VUE_APP_API_BASE=          # 填寫你的 API 地址
VUE_APP_ENV=development
VUE_APP_SENTRY_DSN=        # 可選：Sentry DSN
```

## 構建時設定差異

有些設定隻在特定環境的構建裏需要：

```javascript
// vue.config.js
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  productionSourceMap: false, // 生產環境不生成 source map（安全考慮）

  chainWebpack: (config) => {
    if (isProduction) {
      // 生產環境上傳 source map 到 Sentry
      config.plugin("sentry").use(SentryWebpackPlugin, [
        {
          release: process.env.APP_VERSION,
        },
      ]);
    }
  },

  configureWebpack: {
    // 通過 externals 在生產環境使用 CDN
    externals: isProduction
      ? {
          vue: "Vue",
          "element-ui": "ELEMENT",
        }
      : {},
  },
};
```

## CI/CD 裏的環境變量

在 CI/CD 平臺（GitLab CI、Jenkins）裏設定敏感變量：

```yaml
# .gitlab-ci.yml
build_staging:
  stage: build
  script:
    - npm ci
    - npm run build:staging
  variables:
    VUE_APP_SENTRY_DSN: $STAGING_SENTRY_DSN # 引用 CI 平臺上的 Secret
  environment:
    name: staging
```

## 小結

- 使用 `.env.*` 文件管理多環境配置
- `VUE_APP_` 前綴才會注入客户端
- 敏感信息（密鑰、密碼）絕對不能出現在客户端 bundle
- 提供 `.env.example` 供團隊成員參考
- CI/CD 平臺管理生產環境的敏感變量
