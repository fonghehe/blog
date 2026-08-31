---
title: "Vite Dev Server Principles: Lightning-Fast HMR Based on ESM"
date: 2020-05-09 17:09:28
tags:
  - Engineering
readingTime: 2
description: "After Vite 1.0 launched in 2020, its \"sub-second startup\" amazed many developers. This article analyzes the underlying principles that make this possible and how Vite fundamentally differs from the webpack dev server."
wordCount: 286
---

After Vite 1.0 launched in 2020, its "sub-second startup" amazed a lot of people. This article takes a deep look at the underlying principles that let Vite achieve this, and at how it fundamentally differs from the webpack dev server.

## Traditional webpack Bottlenecks

webpack has to **bundle first, then serve** at startup:

```
启动 webpack dev server：
1. 解析所有入口和依赖树（可能几千个模块）
2. 转换每个模块（TS→JS、Less→CSS 等）
3. 将所有模块打包成 bundle
4. 启动 HTTP 服务，提供 bundle
→ 冷启动时间：几十秒到几分钟（大型项目）
```

This means that when you change a file, webpack has to rebuild the entire affected chunk, then push the update over WebSocket.

## Vite's No-Bundle Approach

```
启动 Vite dev server：
1. 仅预构建 node_modules 中的依赖（esbuild，极快）
2. 启动 HTTP 服务
→ 冷启动时间：< 1 秒

浏览器请求页面时：
按需转换被请求的模块（而不是提前打包所有模块）
```

This relies on modern browsers' native support for ES Modules:

```html
<!-- index.html -->
<script type="module" src="/src/main.ts"></script>
```

Once the browser sees `type="module"`, it parses the `import` statements itself and fires requests. Vite only needs to transform the requested files on the server:

```javascript
// 浏览器请求 /src/App.vue
// Vite 服务端接收请求，实时转换：
// 1. 解析 .vue 文件的 template、script、style
// 2. 将 template 编译成 render function
// 3. 返回 ES module 格式的 JS
```

## Dependency Pre-bundling

Packages in `node_modules` are usually in CommonJS format, which browsers can't `import` directly. Vite pre-bundles these dependencies with **esbuild** on first startup:

```
# Vite 启动时的预构建
node_modules/lodash-es → .vite/lodash-es.js  （合并成单文件，减少请求数）
node_modules/vue       → .vite/vue.js
...
```

esbuild is a bundler written in Go, and it's 10–100× faster than webpack, so this step usually finishes within a few hundred milliseconds.

## How HMR Works

Vite's HMR is more precise than webpack's:

```javascript
// Vite HMR 协议
// 当 src/components/Button.vue 被修改时：
// 1. Vite 文件监听器检测到变化
// 2. 分析该文件的 HMR 边界
// 3. 仅使这个文件的模块缓存失效
// 4. 通过 WebSocket 通知浏览器
// 5. 浏览器重新请求这个文件（而不是整个 bundle）

// 组件内接收 HMR
if (import.meta.hot) {
  import.meta.hot.accept("./Button.vue", (newModule) => {
    // 替换模块
  });
}
```

The HMR plugins for Vue and React (`@vitejs/plugin-vue`, `@vitejs/plugin-react`) handle component-level hot updates automatically, so developers usually don't need to write the code above by hand.

## Comparison with webpack

|            | webpack dev server     | Vite           |
| ---------- | ---------------------- | -------------- |
| Cold start | Slow (bundles all modules) | Fast (transforms on demand) |
| HMR speed  | Milliseconds to seconds (depends on project size) | Always millisecond-level |
| Production build | webpack         | Rollup         |
| Config complexity | High            | Low            |
| Compatibility | IE11+             | Modern browsers |

## Basic vite.config.js Setup

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: { "@": "/src" },
  },
});
```

## Summary

Vite's speed doesn't come from optimizing webpack—it comes from **skipping the bundling step entirely**. By combining the browser's native ESM with esbuild pre-bundling, it turns "bundle first, then serve" into "transform on demand." This way of thinking is essential for understanding the next generation of frontend tooling.
