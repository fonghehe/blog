---
title: "Webpack 5アップグレードガイド：Module Federation入門"
date: 2019-11-15 16:18:45
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Webpack 5 Beta 版が試用可能になり、最も注目されているのは Module Federation です。この機能はマイクロフロントエンドのやり方を変える可能性があります。"
wordCount: 462
---

Webpack 5 Beta 版はすでに試用可能です。最も注目されているのは Module Federation（モジュールフェデレーション）です。この機能はマイクロフロントエンドのあり方を変える可能性があります。

## Webpack 5の主な変更点

### 永続キャッシュ（最も重要）

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: "filesystem", // ハードディスクにキャッシュ（以前はメモリキャッシュのみ）
    buildDependencies: {
      config: [__filename], // 設定ファイル変更時にキャッシュを無効化
    },
  },
};
// 2回目のビルド速度が大幅に向上（私のテストでは 60秒 → 8秒）
```

### 廃止された Node.js polyfill

```javascript
// Webpack 4：Node.js 組み込みモジュールを自動 polyfill
// Webpack 5：自動 polyfill されないため、手動設定が必要
module.exports = {
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"),
      crypto: require.resolve("crypto-browserify"),
      // 不要なモジュールは false に設定
      fs: false,
    },
  },
};
```

## Module Federation：マイクロフロントエンドの新しいアプローチ

```javascript
// host-app/webpack.config.js（消費側）
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "host",
      remotes: {
        // リモートアプリケーションを宣言
        checkout: "checkout@http://localhost:3001/remoteEntry.js",
        analytics: "analytics@http://localhost:3002/remoteEntry.js",
      },
      shared: {
        // 依存関係を共有（重複読み込みを回避）
        react: { singleton: true, requiredVersion: "^16.8.0" },
        "react-dom": { singleton: true },
      },
    }),
  ],
};
```

```javascript
// checkout-app/webpack.config.js（提供側）
new ModuleFederationPlugin({
  name: "checkout",
  filename: "remoteEntry.js", // エントリーファイル
  exposes: {
    // 他のアプリケーションに公開するモジュール
    "./CheckoutForm": "./src/components/CheckoutForm",
    "./CartSummary": "./src/components/CartSummary",
  },
  shared: {
    react: { singleton: true },
    "react-dom": { singleton: true },
  },
});
```

```javascript
// host-app：リモートコンポーネントを動的に読み込み
import React, { lazy, Suspense } from "react";

// 通常のインポートのように見えますが、実際はリモートから読み込みます
const CheckoutForm = lazy(() => import("checkout/CheckoutForm"));
const CartSummary = lazy(() => import("checkout/CartSummary"));

function App() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <CartSummary />
      <CheckoutForm />
    </Suspense>
  );
}
```

## Module Federation vs 従来のマイクロフロントエンド

|            | single-spa           | Module Federation   |
| ---------- | -------------------- | ------------------- |
| 粒度       | アプリケーションレベル | コンポーネント/モジュールレベル |
| 依存共有   | 手動（systemjs map） | 自動（shared 設定） |
| 実行時     | メインアプリのスケジューリングが必要 | オンデマンド読み込み |
| 独立部署   | ✅                   | ✅                  |
| 技術スタック制限 | なし                   | Webpack 5 が必要      |

## 落とし穴

1. **バージョンの不一致**：shared の `singleton: true` によりインスタンスが1つだけであることを保証
2. **ローカル開発**：複数の開発サーバーを同時に起動する必要がある
3. **型サポート**：TypeScript ではリモートモジュールの型を手動で宣言する必要がある

## まとめ

- Webpack 5 の永続キャッシュが最も実用的なメリットであり、2回目のビルドが非常に高速
- Module Federation はマイクロフロントエンドの新しい考え方：アプリケーションレベルの隔離ではなく、モジュールレベルの共有
- Webpack 5 はまだ Beta なので、正式版（2020年）を待ってから本番環境で使用する
