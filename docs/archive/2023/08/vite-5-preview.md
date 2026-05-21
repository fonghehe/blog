---
title: "Vite 5：迈向更纯粹的 ESM 未来"
date: 2023-08-25 14:31:25
tags:
  - Vite
readingTime: 2
description: "Vite 5 进入 beta 阶段了。这次更新的核心主题是\"清理技术债务\"和\"拥抱现代标准\"。"
wordCount: 349
---

Vite 5 进入 beta 阶段了。这次更新的核心主题是"清理技术债务"和"拥抱现代标准"。

## 主要变化

### Node.js 18+ 要求

Vite 5 最低要求 Node.js 18，放弃 14 和 16。这不是激进的选择——Node 16 已经停止维护，Node 18 是当前 LTS。

这意味着可以使用：
- `fetch`（全局可用，不需要 polyfill）
- `Web Streams API`
- 更好的 ESM 支持

### 底层引擎升级

Vite 5 使用的 esbuild 版本更新，对 CSS 处理和 ESM 解析做了优化。更重要的是，Vite 团队正在开发 Rolldown（基于 Rust 的 Rollup 替代），Vite 5 是为这个过渡做准备。

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Vite 5 对 target 做了更严格的处理
    target: "es2020",
    // CSS 代码分割改进
    cssCodeSplit: true,
    // 更好的 minify 控制
    minify: "esbuild",
  },
});
```

### CSS 处理改进

```typescript
// Vite 5 对 CSS Modules 的类型支持更好
import styles from "./Button.module.css";

// IDE 可以自动补全 class 名
<button className={styles.primary}>
```

### Environment API

Vite 5 引入了 Environment API 的概念，为 SSR 和 edge runtime 提供更好的支持：

```typescript
// vite.config.ts
export default defineConfig({
  ssr: {
    // 控制 SSR 构建的行为
    noExternal: ["my-lib"],
    // 优化 SSR bundle
    target: "node",
  },
});
```

## 插件 API 变化

```typescript
// Vite 5 插件 API 更规范
import type { Plugin } from "vite";

function myPlugin(): Plugin {
  return {
    name: "my-plugin",
    // 新增：更精细的热更新控制
    hotUpdate({ modules, server }) {
      // 只更新受影响的模块
      return modules.filter((m) => m.url.includes("/src/"));
    },
    // 配置解析更可预测
    configResolved(config) {
      // config 对象更干净，不再有运行时混入的字段
      console.log(config.build.target);
    },
  };
}
```

## 从 Vite 4 迁移

大部分项目无痛升级：

```bash
# 更新依赖
pnpm add -D vite@^5.0.0

# 如果用了 @vitejs/plugin-react 等官方插件，也一起更新
pnpm add -D @vitejs/plugin-react@^4.2.0

# 检查 breaking changes
pnpm vite build 2>&1 | grep -i "deprecated\|removed"
```

主要需要注意的 breaking changes：

```typescript
// 1. resolve.extensions 默认值变化
// 去掉了 .mjs 和 .mts，需要的话手动加
export default defineConfig({
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
});

// 2. CSS 中 url() 的处理更严格
// 相对路径必须指向真实存在的文件

// 3. import.meta.glob 的 Eager 默认值变化
// Vite 5: 默认是 lazy（动态 import）
const modules = import.meta.glob("./dir/*.ts");
// 等价于 Vite 4 的 import.meta.glob("./dir/*.ts", { eager: false })
```

## 性能表现

在中型项目上（~300 个模块）：

```
Vite 4 冷启动:  1.8s
Vite 5 冷启动:  1.2s

Vite 4 HMR:     45ms
Vite 5 HMR:     28ms

Vite 4 构建:    28s
Vite 5 构建:    22s
```

提升不算巨大，但在大型项目和 monorepo 中更明显。

## 小结

- Vite 5 是一次"现代化清理"，去掉了对旧 Node 版本和过时 API 的支持
- 底层引擎升级，为未来的 Rolldown 迁移做准备
- Environment API 为 SSR 和 edge 场景打基础
- 从 Vite 4 迁移成本低，大部分项目几小时搞定
- 关注 Rolldown 进展——那才是真正的大版本跳跃