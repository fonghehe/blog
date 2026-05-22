---
title: "フロントエンドビルドパフォーマンス最適化：Webpack から Vite へ"
date: 2021-09-20 11:47:17
tags:
  - エンジニアリング
  - Webpack
  - Vite
  - パフォーマンス最適化

readingTime: 4
description: "最近、いくつかのプロジェクトを Webpack から Vite に順次移行しましたが、ビルド速度の差は想像以上に大きいものでした。この記事では、ビルドパフォーマンス最適化のアプローチを、Webpack チューニングから Vite への乗り換え判断に至るまで整理します。"
wordCount: 877
---

最近、いくつかのプロジェクトを Webpack から Vite に順次移行しましたが、ビルド速度の差は想像以上に大きいものでした。この記事では、ビルドパフォーマンス最適化のアプローチを、Webpack チューニングから Vite への乗り換え判断に至るまで整理します。

## Webpack のボトルネックはどこか

Webpack が遅い理由の核心は、**すべてがモジュールであり、モジュールはまずバンドルしてからでないと起動できない** という点にあります。

```
dev server の起動：
1. エントリーファイルを解析
2. すべての import を再帰的に解決 → 完全な依存関係グラフを構築
3. すべてのモジュールをコンパイル（Babel + Loader チェーン）
4. bundle を生成
5. サーバーを起動

プロジェクトが大きくなると、ステップ 2-4 に 30秒〜2分 かかる可能性がある
```

## Webpack のチューニング（どこまでパフォーマンスを絞り出せるか）

### 1. 検索範囲を絞り込む

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: path.resolve(__dirname, 'src'), // src のみ処理
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // 拡張子は書き省くが、列挙しすぎない
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // symlink の解決は不要
    symlinks: false,
  },
}
```

### 2. キャッシュ

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // 永続キャッシュを有効化（Webpack 5 組み込み）
              // ts-loader + transpileOnly で大幅高速化
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  // Webpack 5 永続キャッシュ
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
}
```

### 3. マルチスレッド

```javascript
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // マルチスレッド圧縮
      }),
    ],
  },
  // 或者用 thread-loader
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          'thread-loader', // 後続の loader を worker プールに配置
          'ts-loader',
        ],
      },
    ],
  },
}
```

### 4. DLL（古い方式、Webpack 5 では不要）

```javascript
// Webpack 4 時代の方式：変更されない依存関係を事前バンドル
// Webpack 5 では cache.type: 'filesystem' で代替
```

### Webpack チューニングの天井

ある中規模プロジェクト（200+ モジュール）での実測：

| 最適化項目 | 時間 |
|--------|------|
| 最適化なし | 45s |
| ts-loader transpileOnly | 28s |
| filesystem cache（2回目起動） | 8s |
| thread-loader | 22s |
| すべて最適化 | 6s（2回目起動） |

2回目起動の 6s が Webpack の限界であり、初回起動は依然として 20s+ かかります。

## Vite：発想の転換

Vite の核となる考え方：**開発環境ではバンドルせず、本番環境では Rollup を使用する**。

```
dev server の起動：
1. サーバーを起動（ほぼ瞬時）
2. ブラウザのリクエスト → 必要に応じて単一ファイルをコンパイル
3. 結果を返却

起動時間：< 1s
```

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install
npm run dev   # < 1s 启动
```

## Vite がなぜ速いか

```typescript
// ブラウザが /src/main.ts をリクエスト
// Vite が返却：

// import { createApp } from 'vue'
// ↓ 変換後
import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'

// 各依存関係は事前にビルド済み（esbuild）、各ファイルは個別にコンパイル
// アクセスしたモジュールだけがコンパイルされる
```

- 依存関係の事前ビルド：esbuild（Go 言語で記述、JS より 10〜100 倍高速）
- ソースコードのオンデマンドコンパイル：ESM + ブラウザのネイティブインポート
- HMR：変更されたファイルのみをコンパイルし、依存関係グラフのサイズに依存しない

## パフォーマンスベンチマーク

同一プロジェクト（Vue 3 + TypeScript、200+ コンポーネント）：

| 指標 | Webpack 5（最適化後） | Vite 2.x |
|------|---------------------|----------|
| 初回起動 | 22s | 0.8s |
| 2回目起動（キャッシュ） | 6s | 0.3s |
| HMR | 2-5s | < 100ms |
| プロダクションビルド | 45s | 30s |
| バンドルサイズ（gzip） | 186KB | 178KB |

プロダクションビルドの差は大きくありませんが（Vite は Rollup を使用、Rollup の tree-shaking が優れている）、開発体験の差は非常に大きいです。

## 移行時の注意点

```typescript
// 1. import には拡張子が必要（または resolve.extensions を設定）
import { ref } from 'vue'         // ✅ サードパーティパッケージは拡張子不要
import { useAuth } from './auth'  // ❌ Vite ではデフォルトで拡張子が必要
import { useAuth } from './auth.ts' // ✅

// vite.config.ts で緩和可能
export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue'], // 拡張子解決を追加
  },
})

// 2. 環境変数
// Webpack: process.env.NODE_ENV
// Vite: import.meta.env.MODE

// 3. 静的アセット
// Webpack: require('./logo.png') → URL
// Vite: import logo from './logo.png' → URL

// 4. CSS Modules
// 両方の書き方に対応：
import styles from './index.module.css'  // ✅ Vite 推奨
```

## 移行に適さないプロジェクト

- Webpack プラグインエコシステムに強く依存しているプロジェクト（Module Federation、特殊な loader）
- レガシーな CommonJS プロジェクト（Vite の開発環境は ESM を使用）
- IE11 との互換性が必要なプロジェクト（Vite は対応していない）

## まとめ

- Webpack のチューニングで 45s から 6s に改善できるが、天井がある
- Vite は開発体験を根本的に変えた：オンデマンドコンパイル + esbuild の事前ビルド
- 新規プロジェクトは直接 Vite を、既存プロジェクトは Webpack プラグイン依存を評価して移行判断
- プロダクションビルドの差は小さく、Vite の Rollup tree-shaking がやや優位
- 2021 年、Vite は Vue 3 プロジェクトの事実上の標準となった