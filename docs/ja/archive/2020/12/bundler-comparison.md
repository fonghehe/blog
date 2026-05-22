---
title: "2020年フロントエンドビルドツール比較：webpack vs Rollup vs esbuild vs Vite"
date: 2020-12-26 15:43:36
tags:
  - Node.js
readingTime: 4
description: "2020 年、フロントエンドのビルドツール分野では大きな変化がありました。webpack 5 が正式リリースされ、esbuild が Go 言語による高速バンドルで注目を集め、Vite がまったく新しい No-bundle 開発サーバーソリューションをもたらしました。これら 4 つのツールの位置づけと適用シーンを体系的に整理する時期です。"
wordCount: 877
---

2020 年、フロントエンドのビルドツール分野では大きな変化がありました。webpack 5 が正式リリースされ、esbuild が Go 言語による高速バンドルで注目を集め、Vite がまったく新しい No-bundle 開発サーバーソリューションをもたらしました。これら 4 つのツールの位置づけと適用シーンを体系的に整理する時期です。

## コアポジショニングの比較

| ツール      | 位置づけ             | 基盤言語              | 主な利点                    |
| --------- | ---------------- | --------------------- | --------------------------- |
| webpack 5 | アプリケーションバンドル         | JavaScript            | 成熟したエコシステム、完全な機能          |
| Rollup    | ライブラリバンドル           | JavaScript            | Tree-shaking に優れ、出力がクリーン |
| esbuild   | 超高速変換/バンドル    | Go                    | 10〜100 倍の速度            |
| Vite      | 次世代開発サーバー | JS + Rollup + esbuild | 開発は超高速、本番は Rollup     |

## webpack 5：成熟したアプリケーションバンドラー

**2020 年 10 月に webpack 5 が正式リリースされました**。主な改善点：

```javascript
// webpack.config.js
module.exports = {
  // 1. 永続的キャッシュ（差分ビルド）
  cache: {
    type: "filesystem", // ディスクにキャッシュ
    buildDependencies: {
      config: [__filename], // 設定変更時にキャッシュを無効化
    },
  },

  // 2. Module Federation（マイクロフロントエンド）
  plugins: [
    new ModuleFederationPlugin({
      name: "app1",
      exposes: {
        "./Button": "./src/Button", // コンポーネントを他のアプリケーションに公開
      },
    }),
  ],

  // 3. Asset Modules（file-loader/url-loader の代替）
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: "asset/resource", // file-loader の代わり
      },
    ],
  },
};
```

**適用シーン**：大規模な複雑なアプリケーション、Module Federation を必要とするマイクロフロントエンド、既存の webpack エコシステムのプロジェクト。

## Rollup：ライブラリバンドルの定番

```javascript
// rollup.config.js
export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.cjs.js", format: "cjs" }, // Node.js
    { file: "dist/index.esm.js", format: "esm" }, // ES Module
    { file: "dist/index.umd.js", format: "umd", name: "MyLib" }, // ブラウザ
  ],
  plugins: [typescript(), resolve(), commonjs()],
  external: ["react", "lodash"], // peer dependencies はバンドルしない
};
```

Rollup の tree-shaking は業界のベンチマークであり、生成されるコードはクリーンで簡潔なため、npm パッケージの公開に適しています。Vue 3 や React 自体も Rollup でバンドルされています。

**適用シーン**：コンポーネントライブラリ、ユーティリティ関数群、npm に公開するあらゆるパッケージ。

## esbuild：スピードモンスター

```javascript
// esbuild API でバンドル
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    outfile: "dist/bundle.js",
    platform: "browser",
    target: ["chrome80", "firefox78"],
  })
  .catch(() => process.exit(1));
```

速度比較（中規模プロジェクト、1000 モジュールを含む）：

| ツール      | コールドビルド時間 |
| --------- | ---------- |
| webpack 5 | ~8s        |
| Rollup    | ~4s        |
| esbuild   | ~0.3s      |

しかし esbuild は現時点ではコード分割（code splitting）や CSS modules などの機能をサポートしておらず、エコシステムも十分ではありません。そのため、他のツールの基盤として適しています（Vite は依存関係の事前ビルドに使用しています）。

**適用シーン**：他のツールの基盤（Vite、Parcel）、超高速な TS→JS 変換、CI での高速ビルド。

## Vite：開発体験の革命

```javascript
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 本番ビルドは引き続き Rollup
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
```

Vite の本質は、**開発時は esbuild による前処理 + ネイティブ ESM を、本番は Rollup でバンドルすること**です。

**適用シーン**：新規プロジェクトの開発サーバー、Vue 3 + Vite の公式組み合わせ、超高速な開発起動を求める場合。

## ツール選定の推奨

```
新しいアプリケーションプロジェクト？
  ├── 開発速度を重視 → Vite（開発）、Rollup（本番）
  └── IE 互換性 / 複雑なマイクロフロントエンドが必要 → webpack 5

npm ライブラリの開発？
  └── Rollup（推奨）

ビルドツールの基盤処理？
  └── esbuild（速度優先）

既存の webpack プロジェクト？
  └── webpack 5 にアップグレード（永続的キャッシュでビルド時間を 60% 削減可能）
```

## まとめ

2020 年のビルドツールの状況変化は、**開発体験とビルド速度が中核的な競争力になる**というトレンドを示しています。esbuild の速度と Vite の理念はすでにエコシステム全体に影響を与えており、webpack 5 の永続的キャッシュや SWC の登場は、すべてこのトレンドへの対応です。
