---
title: "Vite開発サーバーの原理：ESMベースの超高速ホットリロード"
date: 2020-05-09 17:09:28
tags:
  - エンジニアリング
readingTime: 2
description: "Vite 1.0 在 2020 年发布后，\"秒级启动\"让很多人惊叹。本文深入分析 Vite 能做到这一点的底层原理，以及它和 webpack dev server 的根本区别。"
---

Vite 1.0 在 2020 年发布后，"秒级启动"让很多人惊叹。本文深入分析 Vite 能做到这一点的底层原理，以及它和 webpack dev server 的根本区别。

## 従来のwebpackのボトルネック

webpack 在启动时必须**先打包再服务**：

```
启动 webpack dev server：
1. 解析所有入口和依赖树（可能几千个模块）
2. 转换每个模块（TS→JS、Less→CSS 等）
3. 将所有模块打包成 bundle
4. 启动 HTTP 服务，提供 bundle
→ 冷启动时间：几十秒到几分钟（大型项目）
```

这意味着你改一个文件，webpack 需要重新构建受影响的整个 chunk，然后通过 WebSocket 发送更新。

## ViteのNo-bundleアプローチ

```
启动 Vite dev server：
1. 仅预构建 node_modules 中的依赖（esbuild，极快）
2. 启动 HTTP 服务
→ 冷启动时间：< 1 秒

浏览器请求页面时：
按需转换被请求的模块（而不是提前打包所有模块）
```

这依赖于现代浏览器原生支持 ES Module：

```html
<!-- index.html -->
<script type="module" src="/src/main.ts"></script>
```

浏览器看到 `type="module"` 后，会自行解析 `import` 语句并发起请求。Vite 只需要在服务端转换被请求的文件：

```javascript
// 浏览器请求 /src/App.vue
// Vite 服务端接收请求，实时转换：
// 1. 解析 .vue 文件的 template、script、style
// 2. 将 template 编译成 render function
// 3. 返回 ES module 格式的 JS
```

## 依赖预构建

`node_modules` 中的包通常是 CommonJS 格式，浏览器不能直接 `import`。Vite 在首次启动时用 **esbuild** 预构建这些依赖：

```
# Vite 启动时的预构建
node_modules/lodash-es → .vite/lodash-es.js  （合并成单文件，减少请求数）
node_modules/vue       → .vite/vue.js
...
```

esbuild 是 Go 语言编写的打包工具，速度比 webpack 快 10-100 倍，所以这个步骤通常在几百毫秒内完成。

## HMR 实现原理

Vite 的 HMR 比 webpack 更精准：

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

Vue 和 React 的 HMR 插件（`@vitejs/plugin-vue`、`@vitejs/plugin-react`）自动处理组件级热更新，开发者通常不需要手写上面的代码。

## 与 webpack 的对比

|            | webpack dev server     | Vite           |
| ---------- | ---------------------- | -------------- |
| 冷启动     | 慢（需要打包所有模块） | 快（按需转换） |
| HMR 速度   | 毫秒~秒（依项目大小）  | 始终毫秒级     |
| 生产构建   | webpack                | Rollup         |
| 配置复杂度 | 高                     | 低             |
| 兼容性     | IE11+                  | 现代浏览器     |

## vite.config.js 基础配置

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

## まとめ

Vite 的快不是优化了 webpack，而是**绕过了打包这一步**。利用浏览器原生 ESM + esbuild 预构建，将"先打包再服务"变成了"按需转换"。这个思路对于理解下一代前端工具链非常重要。
