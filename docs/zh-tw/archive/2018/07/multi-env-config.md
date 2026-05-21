---
title: "前端工程化：多環境配置管理"
date: 2018-07-17 15:05:37
tags:
  - 前端
readingTime: 2
description: "專案通常有 development、staging、production 三個環境，各有不同的 API 地址、Feature Flag 等配置。這篇文章整理多環境配置的最佳實踐。"
wordCount: 293
---

專案通常有 development、staging、production 三個環境，各有不同的 API 地址、Feature Flag 等配置。這篇文章整理多環境配置的最佳實踐。

## 環境變數基礎

### Vue CLI 3 的方式（推薦）

Vue CLI 3 內建了 dotenv 支援，讀取 `.env.*` 檔案：

```
.env                  所有環境都載入
.env.local            所有環境載入，但不提交 git（用於本地覆蓋）
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

**注意：以 `VUE_APP_` 開頭的變數才會被注入到客戶端程式碼。**

```javascript
// 在程式碼裡使用
const apiBase = process.env.VUE_APP_API_BASE;
const isDebug = process.env.VUE_APP_DEBUG === "true";
```

### 執行指定環境

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

## 多環境的配置結構

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
  // 顯示除錯面板
}
```

## 敏感資訊處理

**永遠不要把金鑰放在客戶端程式碼裡：**

```bash
# ❌ 不要這樣做，即使在 .env 檔案裡
VUE_APP_STRIPE_SECRET_KEY=sk_live_xxxxx  # 會被打包進 JS！
VUE_APP_DB_PASSWORD=xxxxx

# ✅ 只放公開配置
VUE_APP_STRIPE_PUBLIC_KEY=pk_live_xxxxx  # publishable key 是可以公開的
VUE_APP_API_BASE=https://api.example.com
```

私密資訊（API secret、資料庫密碼）只放在**服務端**的環境變數裡。

## .env 檔案的 Git 管理

```ini
# .gitignore
.env.local
.env.*.local

# 這些可以提交，但不包含敏感資訊
# .env
# .env.development
# .env.staging
# .env.production
```

提供示例檔案，讓新同學知道需要哪些變數：

```bash
# .env.example（提交到 git）
VUE_APP_API_BASE=          # 填寫你的 API 地址
VUE_APP_ENV=development
VUE_APP_SENTRY_DSN=        # 可選：Sentry DSN
```

## 構建時配置差異

有些配置只在特定環境的構建裡需要：

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

## CI/CD 裡的環境變數

在 CI/CD 平臺（GitLab CI、Jenkins）裡配置敏感變數：

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

- 使用 `.env.*` 檔案管理多環境配置
- `VUE_APP_` 字首才會注入客戶端
- 敏感資訊（金鑰、密碼）絕對不能出現在客戶端 bundle
- 提供 `.env.example` 供團隊成員參考
- CI/CD 平臺管理生產環境的敏感變數
