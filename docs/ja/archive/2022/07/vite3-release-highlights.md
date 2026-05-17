---
title: "Vite 3.0 リリース：ネイティブ ESM、新 CLI、より良い SSR"
date: 2022-07-20 17:22:12
tags:
  - Vite
readingTime: 3
description: "Vite 3.0 が2022年7月13日に正式リリースされました。Vite 2.0 のリリースから16ヶ月が経過し、このメジャーバージョンアップでは一連の重要な改善が行われました：Rollup 3 ベースのビルド、統一された dev/build 動作、改善された SSR サポート、そしてより明確な CLI 出力。"
---

Vite 3.0 が2022年7月13日に正式リリースされました。Vite 2.0 のリリースから16ヶ月が経過し、このメジャーバージョンアップでは一連の重要な改善が行われました：Rollup 3 ベースのビルド、統一された dev/build 動作、改善された SSR サポート、そしてより明確な CLI 出力。

## 主な変更：古い Node.js バージョンのサポート終了

```bash
# Vite 3 要求 Node.js 14.18+（以前是 12.x）
node --version  # 确保 >= 14.18

# 升级 Vite
npm install vite@3
```

## デフォルト開発サーバーポートの変更

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

## ビルドの改善：Rollup 3 ベース

Vite 3 は Rollup 3（2.x から）にアップグレードし、主な改善をもたらしました：

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

## 統一された dev/build 動作

Vite 2.x には典型的な問題がありました：開発環境（ESM dev サーバー）と本番ビルド（Rollup）の動作が一致せず、「dev では正常、build でエラー」という問題を引き起こしていました。Vite 3 は統一された処理方法でこれらの差異を減らしています。

**资源导入行为统一**：

```javascript
// Vite 3 中，这两种环境的资源导入行为更接近
import logo from "./assets/logo.svg?url"; // 明确请求 URL
import logoContent from "./assets/logo.svg?raw"; // 明确请求内容

// 不再依赖隐式行为判断是否处理为 data URI 或 URL
```

## SSR の改善

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

## CLI 出力の最適化

Vite 3 のビルド出力はよりクリアになりました：

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

## アップグレードと移行

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

## まとめ

Vite 3 は着実に成熟したリリースであり、破壊的な変更はありませんが、細部に多くの磨きがかかっています。Rollup 3 ベースのビルドはより信頼性が高く、SSR サポートはより完全になり、統一された dev/build 動作により環境の一貫性の問題が減少しました。Vite 2 を使用しているプロジェクトにとって、アップグレードコストは最小限であり、追跡する価値があります。