---
title: "Vite：下一代前端构建工具体验"
date: 2020-05-20 17:39:20
tags:
  - 工程化
---

尤雨溪在直播中介绍了 Vite（法语"快"的意思），我立刻拿来试了试。感觉颠覆了我对开发工具的认知。

## 核心思路：利用浏览器原生 ES Modules

传统开发服务器（Webpack dev server）：

- 启动时打包所有模块
- 项目大 → 启动时间长（我们项目现在要 60s）
- 热更新也要重新打包相关模块

Vite 的做法：

- 启动时**不打包**，直接利用浏览器原生 ESM
- 浏览器请求哪个模块，才处理哪个模块
- 启动时间基本恒定（不管项目多大）

```
浏览器请求 /src/main.ts
 → Vite 拦截，实时编译 TypeScript
 → 返回 ES Module
 → 浏览器解析 import，发出新请求
 → Vite 处理新请求...
```

## 实际体验

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

## 和 Webpack 的区别

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

## HMR 热更新

```
Webpack HMR：
  文件变化 → 重新编译相关模块链 → 替换

Vite HMR：
  文件变化 → 直接发 invalidation 信号 → 浏览器重新请求该模块

  速度快很多，而且和项目大小无关
```

## 生产构建：基于 Rollup

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

## 2020 年 5 月的现状

- 只支持 Vue 3（当时）
- API 还不稳定（Vite 1.0 要年底）
- 部分边缘情况处理不好
- SSR 支持还不完善

但这个方向是对的，我很确定。等 1.0 稳定后会在项目中使用。

## 小结

- Vite 利用原生 ESM，开发服务器启动几乎瞬间
- 零配置支持 TS、Vue、React、CSS 预处理器
- 生产构建用 Rollup，输出 ESM + 传统格式
- 2020 年还不成熟，等 2021 年 Vite 2 再评估生产使用
