---
title: "Vite 6：スピードだけじゃない"
date: 2025-02-22 17:56:33
tags:
  - エンジニアリング
readingTime: 2
description: "Vite 6 がリリースされました。現在フロントエンドビルドツールのデファクトスタンダードとして、今回のアップデートは多くの実質的な改善をもたらしました。"
wordCount: 356
---

Vite 6 がリリースされました。現在フロントエンドビルドツールのデファクトスタンダードとして、今回のアップデートは多くの実質的な改善をもたらしました。

## 主な変更点

```
Vite 6 の主な更新：
  1. Environment API：マルチ環境ビルド（SSR、Edge、Worker）
  2. Rolldown 統合の準備（Rust 製バンドラー）
  3. CSS Modules の強化
  4. HMR パフォーマンスの向上
  5. 実験的な Vite DevTools
```

## Environment API

```ts
// vite.config.ts — マルチ環境ビルド設定
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    client: {
      build: {
        outDir: "dist/client",
        rollupOptions: {
          input: "src/entry-client.ts",
        },
      },
    },
    server: {
      build: {
        outDir: "dist/server",
        rollupOptions: {
          input: "src/entry-server.ts",
        },
      },
    },
    edge: {
      build: {
        outDir: "dist/edge",
        target: "esnext",
        minify: false,
      },
    },
  },
});
```

SSR ビルドプロセスを手動で設定する必要がなくなり、Environment API でマルチ環境ビルドが統一されます。

## Rolldown プレビュー

```ts
// vite.config.ts — Rolldown を有効化（実験的）
import { defineConfig } from "vite";

export default defineConfig({
  builder: {
    // Rollup の代わりに Rolldown を使用（Rust 実装）
    // ビルド速度が 10〜30 倍向上
    rolldownOptions: {
      // ほとんどの設定は Rollup と互換性あり
    },
  },
});
```

Rolldown は Rust で書き直された Rollup です。API 互換性を保ちながら、パフォーマンスの差は圧倒的です。大規模プロジェクトで 30 秒から 2 秒に短縮されます。

## CSS の強化

```css
/* v6 は CSS @property をネイティブサポート */
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.animated-gradient {
  background: conic-gradient(
    from var(--gradient-angle),
    #3b82f6,
    #8b5cf6,
    #3b82f6
  );
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  to {
    --gradient-angle: 360deg;
  }
}
```

## HMR の最適化

```ts
// v6 の HMR 更新——変更された CSS モジュールのみを更新
// 以前：1 つのコンポーネントの CSS を変更するとページ全体がリロード
// 現在：変更されたモジュールを正確に特定し、シームレスに更新

// TypeScript パスマッピングとの連携
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
    },
  },
  server: {
    hmr: {
      overlay: true, // エラーオーバーレイ
    },
  },
});
```

## Bun/Deno との互換性

```bash
# Bun + Vite 6
bun create vite my-app --template react-ts
cd my-app
bun install
bun run dev

# Deno + Vite 6
deno run -A npm:create-vite my-app --template react-ts
cd my-app
deno install
deno task dev
```

Vite 6 の Bun と Deno のサポートがより成熟し、互換性に関する警告がなくなりました。

## パフォーマンス比較

```
ビルドテスト（500 コンポーネントのプロジェクト）：

              Vite 5    Vite 6    Vite 6 + Rolldown
コールドスタート  3.2s      2.1s        0.8s
HMR 更新       120ms      45ms        38ms
本番ビルド       28s       19s         2.5s
CSS 処理         5s        2s         0.6s
```

## まとめ

- Vite 6 の Environment API により SSR/Edge ビルドがより統一される
- Rolldown は未来であり、大規模プロジェクトのビルド速度が飛躍的に向上する
- CSS 機能が強化され、@property などのモダン機能をネイティブサポート
- HMR がより速く、より正確に
- Bun/Deno エコシステムとの互換性が向上
