---
title: "前端工程化：多环境配置管理"
date: 2018-07-17 15:05:37
tags:
  - 前端
---

项目通常有 development、staging、production 三个环境，各有不同的 API 地址、Feature Flag 等配置。这篇文章整理多环境配置的最佳实践。

## 环境变量基础

### Vue CLI 3 的方式（推荐）

Vue CLI 3 内置了 dotenv 支持，读取 `.env.*` 文件：

```
.env                  所有环境都加载
.env.local            所有环境加载，但不提交 git（用于本地覆盖）
.env.development      development 环境
.env.staging          staging 环境（自定义）
.env.production       production 环境
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

**注意：以 `VUE_APP_` 开头的变量才会被注入到客户端代码。**

```javascript
// 在代码里使用
const apiBase = process.env.VUE_APP_API_BASE;
const isDebug = process.env.VUE_APP_DEBUG === "true";
```

### 运行指定环境

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

## 多环境的配置结构

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
  // 显示调试面板
}
```

## 敏感信息处理

**永远不要把密钥放在客户端代码里：**

```bash
# ❌ 不要这样做，即使在 .env 文件里
VUE_APP_STRIPE_SECRET_KEY=sk_live_xxxxx  # 会被打包进 JS！
VUE_APP_DB_PASSWORD=xxxxx

# ✅ 只放公开配置
VUE_APP_STRIPE_PUBLIC_KEY=pk_live_xxxxx  # publishable key 是可以公开的
VUE_APP_API_BASE=https://api.example.com
```

私密信息（API secret、数据库密码）只放在**服务端**的环境变量里。

## .env 文件的 Git 管理

```gitignore
# .gitignore
.env.local
.env.*.local

# 这些可以提交，但不包含敏感信息
# .env
# .env.development
# .env.staging
# .env.production
```

提供示例文件，让新同学知道需要哪些变量：

```bash
# .env.example（提交到 git）
VUE_APP_API_BASE=          # 填写你的 API 地址
VUE_APP_ENV=development
VUE_APP_SENTRY_DSN=        # 可选：Sentry DSN
```

## 构建时配置差异

有些配置只在特定环境的构建里需要：

```javascript
// vue.config.js
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  productionSourceMap: false, // 生产环境不生成 source map（安全考虑）

  chainWebpack: (config) => {
    if (isProduction) {
      // 生产环境上传 source map 到 Sentry
      config.plugin("sentry").use(SentryWebpackPlugin, [
        {
          release: process.env.APP_VERSION,
        },
      ]);
    }
  },

  configureWebpack: {
    // 通过 externals 在生产环境使用 CDN
    externals: isProduction
      ? {
          vue: "Vue",
          "element-ui": "ELEMENT",
        }
      : {},
  },
};
```

## CI/CD 里的环境变量

在 CI/CD 平台（GitLab CI、Jenkins）里配置敏感变量：

```yaml
# .gitlab-ci.yml
build_staging:
  stage: build
  script:
    - npm ci
    - npm run build:staging
  variables:
    VUE_APP_SENTRY_DSN: $STAGING_SENTRY_DSN # 引用 CI 平台上的 Secret
  environment:
    name: staging
```

## 小结

- 使用 `.env.*` 文件管理多环境配置
- `VUE_APP_` 前缀才会注入客户端
- 敏感信息（密钥、密码）绝对不能出现在客户端 bundle
- 提供 `.env.example` 供团队成员参考
- CI/CD 平台管理生产环境的敏感变量
