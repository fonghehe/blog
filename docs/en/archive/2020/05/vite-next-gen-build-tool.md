---
title: "Vite: Next-Generation Frontend Build Tool Experience"
date: 2020-05-20 17:39:20
tags:
  - Engineering
readingTime: 1
description: "Evan You introduced Vite (French for \"fast\") during a livestream, and I immediately tried it out. It completely changed how I think about development tooling."
wordCount: 211
---

Evan You introduced Vite (French for "fast") during a livestream, and I immediately went to try it out. It completely changed how I think about development tooling.

## Core Idea: Leveraging Native Browser ES Modules

Traditional dev server (Webpack dev server):

- Bundles all modules at startup
- Large project → long startup time (our project currently takes 60s)
- Hot updates also require re-bundling the relevant modules

Vite's approach:

- Does **not bundle** at startup; uses the browser's native ESM directly
- Only processes the module the browser actually requests
- Startup time is basically constant (regardless of project size)

```
浏览器请求 /src/main.ts
 → Vite 拦截，实时编译 TypeScript
 → 返回 ES Module
 → 浏览器解析 import，发出新请求
 → Vite 处理新请求...
```

## Actual Experience

```bash
npm init vite-app my-app
cd my-app
npm install
npm run dev  # 500ms 启动！（Webpack 要 60s）
```

```javascript
// vite.config.js
module.exports = {
  // 配置极简
  alias: {
    "@": "/src",
  },
  optimizeDeps: {
    // 预优化：把 CommonJS 依赖转为 ESM（只做一次）
    include: ["lodash-es", "axios"],
  },
};
```

## Differences from Webpack

```javascript
// Webpack：需要大量配置才能支持 TypeScript
module.exports = {
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader" },
      { test: /\.vue$/, use: "vue-loader" },
      { test: /\.scss$/, use: ["style-loader", "css-loader", "sass-loader"] },
    ],
  },
  plugins: [...很多插件],
};

// Vite：内置支持，零配置
// TypeScript、Vue、React、CSS、SCSS... 都开箱即用
```

## HMR (Hot Module Replacement)

```
Webpack HMR：
  文件变化 → 重新编译相关模块链 → 替换

Vite HMR：
  文件变化 → 直接发 invalidation 信号 → 浏览器重新请求该模块

  速度快很多，而且和项目大小无关
```

## Production Build: Based on Rollup

```javascript
// 生产环境用 Rollup 打包（ESM + Tree Shaking）
// 不是直接服务 ESM（浏览器大量 HTTP 请求不适合生产）

// vite.config.js
module.exports = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "vuex"],
        },
      },
    },
  },
};
```

## State of Things in May 2020

- Only Vue 3 was supported at the time
- The API wasn't stable yet (Vite 1.0 wouldn't land until the end of the year)
- Some edge cases weren't handled well
- SSR support was still incomplete

But this direction is right—I'm sure of it. Once 1.0 stabilizes I'll use it in my projects.

## Summary

- Vite uses native ESM, so the dev server starts almost instantly.
- Zero-config support for TS, Vue, React, and CSS preprocessors.
- Production builds use Rollup, outputting ESM plus traditional formats.
- In 2020 it's still immature; wait for Vite 2 in 2021 before evaluating it for production.
