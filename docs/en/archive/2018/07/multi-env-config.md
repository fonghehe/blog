---
title: "Frontend Engineering: Multi-Environment Configuration Management"
date: 2018-07-17 15:05:37
tags:
  - Frontend
readingTime: 2
description: "Projects typically have development, staging, and production environments with different API endpoints, feature flags, and other configurations. This post cover"
---

Projects typically have development, staging, and production environments with different API endpoints, feature flags, and other configurations. This post covers best practices for multi-environment config management.

## Environment Variables Basics

### Vue CLI 3's Approach (Recommended)

Vue CLI 3 has built-in dotenv support and reads `.env.*` files:

```
.env                  loaded in all environments
.env.local            all environments, but not committed to git (for local overrides)
.env.development      development environment
.env.staging          staging environment (custom)
.env.production       production environment
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

**Note: only variables prefixed with `VUE_APP_` are injected into client-side code.**

```javascript
// Using in code
const apiBase = process.env.VUE_APP_API_BASE;
const isDebug = process.env.VUE_APP_DEBUG === "true";
```

### Running a Specific Environment

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

## Multi-Environment Config Structure

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
// Usage
import config from "@/config";

axios.defaults.baseURL = config.apiBase;

if (config.features.debugPanel) {
  // show debug panel
}
```

## Handling Sensitive Information

**Never put secret keys in client-side code:**

```bash
# ❌ Don't do this, even in .env files
VUE_APP_STRIPE_SECRET_KEY=sk_live_xxxxx  # will be bundled into JS!
VUE_APP_DB_PASSWORD=xxxxx

# ✅ Only put public config
VUE_APP_STRIPE_PUBLIC_KEY=pk_live_xxxxx  # publishable keys can be public
VUE_APP_API_BASE=https://api.example.com
```

Secrets (API secrets, database passwords) belong only in **server-side** environment variables.

## Git Management of .env Files

```ini
# .gitignore
.env.local
.env.*.local

# These can be committed (without sensitive info):
# .env
# .env.development
# .env.staging
# .env.production
```

Provide a sample file so new team members know what variables are needed:

```bash
# .env.example (committed to git)
VUE_APP_API_BASE=          # fill in your API base URL
VUE_APP_ENV=development
VUE_APP_SENTRY_DSN=        # optional: Sentry DSN
```

## Build-time Configuration Differences

Some config is only needed for specific environment builds:

```javascript
// vue.config.js
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  productionSourceMap: false, // don't generate source maps in production (security)

  chainWebpack: (config) => {
    if (isProduction) {
      // upload source maps to Sentry in production
      config.plugin("sentry").use(SentryWebpackPlugin, [
        {
          release: process.env.APP_VERSION,
        },
      ]);
    }
  },

  configureWebpack: {
    // use CDN externals in production
    externals: isProduction
      ? {
          vue: "Vue",
          "element-ui": "ELEMENT",
        }
      : {},
  },
};
```

## Environment Variables in CI/CD

Configure sensitive variables on the CI/CD platform (GitLab CI, Jenkins):

```yaml
# .gitlab-ci.yml
build_staging:
  stage: build
  script:
    - npm ci
    - npm run build:staging
  variables:
    VUE_APP_SENTRY_DSN: $STAGING_SENTRY_DSN # references a CI platform secret
  environment:
    name: staging
```
