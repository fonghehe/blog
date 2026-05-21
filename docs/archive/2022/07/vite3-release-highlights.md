---
title: "Vite 3.0 发布：ESM 原生、全新 CLI 与更好的 SSR"
date: 2022-07-20 17:22:12
tags:
  - Vite
readingTime: 2
description: "Vite 3.0 于 2022 年 7 月 13 日正式发布。距离 Vite 2.0 发布已经过去了 16 个月，这次版本号升级带来了一系列重要改进：基于 Rollup 3 的构建、统一的 dev/build 行为、改善的 SSR 支持，以及更清晰的 CLI 输出。"
wordCount: 316
---

Vite 3.0 于 2022 年 7 月 13 日正式发布。距离 Vite 2.0 发布已经过去了 16 个月，这次版本号升级带来了一系列重要改进：基于 Rollup 3 的构建、统一的 dev/build 行为、改善的 SSR 支持，以及更清晰的 CLI 输出。

## 主要变化：不再支持旧版 Node.js

```bash
# Vite 3 要求 Node.js 14.18+（以前是 12.x）
node --version  # 确保 >= 14.18

# 升级 Vite
npm install vite@3
```

## 开发服务器默认端口变化

```bash
# Vite 2.x 默认端口
# → http://localhost:3000

# Vite 3.x 默认端口变为 5173
# → http://localhost:5173

# 避免与其他常见开发服务器（如 Express 的 3000）冲突
```

自定义端口：

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000, // 恢复到 3000（如果需要）
    strictPort: true, // 端口被占用时直接报错，不自动递增
  },
  preview: {
    port: 8080, // vite preview 的端口也可以单独配置
  },
});
```

## 构建改进：基于 Rollup 3

Vite 3 升级到 Rollup 3（从 2.x），带来的主要改进：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // Rollup 3 的 target 默认从 es2019 → es2020
    target: "es2020",

    // 新增：模块预加载 polyfill 可以关闭（现代浏览器不需要）
    modulePreload: {
      polyfill: false, // 减小 bundle 体积
    },

    rollupOptions: {
      output: {
        // Rollup 3 的手动分包更精确
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // 按顶级包名分包
            const pkg = id.split("node_modules/")[1].split("/")[0];
            return `vendor-${pkg}`;
          }
        },
      },
    },
  },
});
```

## 统一的 dev/build 行为

Vite 2.x 存在一个经典问题：开发环境（ESM dev server）和生产构建（Rollup）行为不一致，导致"dev 正常、build 报错"的问题。Vite 3 通过统一处理方式减少了这类差异。

**资源导入行为统一**：

```javascript
// Vite 3 中，这两种环境的资源导入行为更接近
import logo from "./assets/logo.svg?url"; // 明确请求 URL
import logoContent from "./assets/logo.svg?raw"; // 明确请求内容

// 不再依赖隐式行为判断是否处理为 data URI 或 URL
```

## SSR 改进

```typescript
// vite.config.ts - SSR 相关改进
export default defineConfig({
  ssr: {
    // Vite 3 的 noExternal 支持正则表达式
    noExternal: [/^@my-org\//], // 所有 @my-org 开头的包都被打包进 SSR

    // 新增：target 可以指定 SSR 构建目标
    target: "node", // 或 'webworker'（用于 Edge Runtime）
  },
  build: {
    ssr: true, // 生产 SSR 构建
  },
});
```

## CLI 输出优化

Vite 3 的构建输出更清晰：

```
# Vite 2.x 输出（信息密集，难以区分重要信息）
dist/assets/index.d59c0a4e.js           148.34 KiB / gzip: 47.35 KiB
dist/assets/vendor.ce422158.js          231.03 KiB / gzip: 72.27 KiB

# Vite 3.x 输出（更分层，大文件有警告）
dist/index.html                    0.45 kB
dist/assets/index-d59c0a4e.js    148.34 kB │ gzip: 47.35 kB
dist/assets/vendor-ce422158.js   231.03 kB │ gzip: 72.27 kB

(!) Some chunks are larger than 500 kB after minification.
Consider code-splitting or using dynamic import() to improve performance.
```

## 升级迁移

```bash
# 升级依赖
npm install vite@3 @vitejs/plugin-vue@3  # 或 @vitejs/plugin-react@2

# 主要 breaking changes 检查：
# 1. 默认端口 3000 → 5173
# 2. import.meta.glob() 默认变为懒加载（可加 eager: true 恢复）
# 3. 部分 SSR 相关 API 重命名
```

**`import.meta.glob` 变化**：

```javascript
// Vite 2：默认 eager（同步）
const modules = import.meta.glob("./modules/*.ts");

// Vite 3：默认 lazy（异步）需要 await
const modules = import.meta.glob("./modules/*.ts");
// modules 现在是 () => Promise<...> 格式

// 如果需要旧行为（同步加载）：
const modules = import.meta.glob("./modules/*.ts", { eager: true });
```

## 总结

Vite 3 是一个稳步成熟的版本，没有颠覆性变化，但在细节上做了大量打磨。基于 Rollup 3 的构建更可靠，SSR 支持更完善，dev/build 行为统一减少了环境一致性问题。对于已经在用 Vite 2 的项目，升级代价很小，值得跟进。