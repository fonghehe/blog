---
title: "Vite 3：フロントエンドビルドツールの分水嶺"
date: 2022-02-08 10:39:57
tags:
  - Vite
readingTime: 3
description: "Vite 3 がリリースされました。Vite 2 から 3 への移行は、単なるバージョン番号の変更ではありません。コールドスタートがより高速になり、開発体験が向上し、プラグインエコシステムがより成熟しました。チームのビルドインフラストラクチャの技術選定責任者として、Vite 3 の核心的な変更点と移行経験について紹介します。"
wordCount: 585
---

Vite 3 がリリースされました。Vite 2 から 3 へは、単なるバージョン番号の変更ではありません。コールドスタートがより高速になり、開発体験が向上し、プラグインエコシステムがより成熟しました。チームのビルドインフラストラクチャの技術選定責任者として、Vite 3 の核心的な変更点と移行経験について紹介します。

## 主な改善点

### コールドスタートの最適化

Vite 3 の開発サーバーのコールドスタートは Vite 2 よりも大幅に高速化しました。主な最適化：

```bash
# Vite 3 は esbuild で依存関係のプリビルドを行いますが、キャッシュ戦略が最適化されました
vite --force  # 強制的に再プリビルド（キャッシュをクリア）

# プリビルド分析を表示
DEBUG=vite:deps npx vite
```

### 組み込みの CSS Modules サポート

```css
/* styles.module.css */
.container {
  background: #f5f5f5;
}

/* CSS Modules を自動サポート、追加設定は不要 */
```

```typescript
// 直接インポート
import styles from './styles.module.css';

// 型サポート付き（vite-plugin-css-modules-types と併用）
const cls = styles.container;
```

### ビルドの最適化

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 3 は CSS コード分割をサポート
    cssCodeSplit: true,
    // より良い sourcemap サポート
    sourcemap: true,
    // rollup バンドル設定
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  // Vite 3 新機能：開発サーバー設定
  server: {
    // より高速な HMR
    hmr: {
      overlay: true,
    },
  },
});
```

## プラグインエコシステム

Vite 3 のプラグインエコシステムはすでに成熟しています。私たちがよく使うコアプラグイン：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import Inspect from 'vite-plugin-inspect';

export default defineConfig({
  plugins: [
    react(),

    // TypeScript 型チェック（コンパイルをブロックしない）
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint src --ext .ts,.tsx',
      },
    }),

    // 画像圧縮
    ViteImageOptimizer({
      jpeg: { quality: 80 },
      png: { quality: 80 },
    }),

    // デバッグプラグイン（中間状態を確認）
    Inspect(),
  ],
});
```

## Webpack からの移行実践

```typescript
// webpack.config.js → vite.config.ts

// Before (Webpack):
// module.exports = {
//   resolve: { alias: { '@': path.resolve('src') } },
//   module: { rules: [{ test: /\.svg/, use: ['@svgr/webpack'] }] },
//   plugins: [new HtmlWebpackPlugin(), new DefinePlugin({...})],
//   devServer: { port: 3000, proxy: { '/api': 'http://localhost:8080' } },
// };

// After (Vite):
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    svgr(),  // SVG を React コンポーネントとしてインポート
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: { '@primary-color': '#1890ff' },
        javascriptEnabled: true,
      },
    },
  },
});
```

### 環境変数の移行

```bash
# Webpack: .env では REACT_APP_ プレフィックス
REACT_APP_API_URL=https://api.example.com

# Vite: VITE_ プレフィックスに変更
VITE_API_URL=https://api.example.com
```

```typescript
// 移行前
const url = process.env.REACT_APP_API_URL;

// 移行後
const url = import.meta.env.VITE_API_URL;
```

## Monorepo での Vite 設定の共有

```typescript
// packages/vite-config/index.ts
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export function createViteConfig(
  overrides: Partial<UserConfig> = {}
): UserConfig {
  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve('src') },
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
    },
    ...overrides,
  });
}

// apps/admin/vite.config.ts
import { createViteConfig } from '@mono/vite-config';

export default createViteConfig({
  server: { port: 3001 },
  build: {
    outDir: 'dist/admin',
  },
});
```

## パフォーマンス比較

私たちが担当した中規模バックエンドプロジェクト（200+ ページコンポーネント）の実測データ：

| 指標 | Webpack 5 | Vite 2 | Vite 3 |
|------|-----------|--------|--------|
| 冷起動 | 45s | 3.2s | 2.1s |
| HMR | 800ms | 28ms | 18ms |
| プロダクションビルド | 120s | 35s | 28s |

コールドスタートの改善が最も顕著で、開発体験が質的に向上しました。

## まとめ

Vite 3 はフロントエンドビルドツールが新たな段階に入ったことを示しています。ブラウザネイティブの ESM に基づく開発モードは実現可能であることが実証されました。新規プロジェクトでは Vite を使わない理由はありません。既存プロジェクトでも移行コストは低く、メリットは明らかです。次回は Vitest（Vite ネイティブのテストフレームワーク）について書き、Vite と組み合わせて完全なツールチェーンを構成する予定です。
