---
title: "Webpack 5プレビュー：Module Federation"
date: 2019-10-14 16:20:40
tags:
  - Webpack
  - エンジニアリング
readingTime: 6
description: "Webpack 5 は現在も Beta 段階ですが、多くのエキサイティングな改善がもたらされています。中でも最も注目すべきは Module Federation です——フロントエンドマイクロサービスの実装方法を根本的に変えました。この記事では Webpack 5 の主要な新機能を紹介し、Module Federation の動作原理を重点的に解説します。"
wordCount: 1281
---

Webpack 5 は Beta 段階ではありますが、すでに数多くのエキサイティングな改善が含まれています。特に注目すべきは Module Federation です。これはフロントエンドマイクロサービスの実装方法を根本的に変えるものです。本記事では Webpack 5 の核心的な新機能を紹介し、Module Federation の動作原理を詳しく見ていきます。

## Webpack 5 全体的な改善の概要

Webpack 5 の改善点は主に以下の側面に集中しています：

### 長期キャッシュの最適化

Webpack 5 はモジュール ID とチャンク ID の決定論的アルゴリズムを改善しました：

```js
// webpack.config.js
module.exports = {
  // 決定論的なモジュール ID を使用し、モジュール ID の変更によるキャッシュ無効化を防止
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
};
```

新しい `chunkIds` と `moduleIds` オプション：

- `'natural'`：使用順の数字 ID
- `'named'`：読みやすいモジュール名（開発用）
- `'deterministic'`：短い数字 ID、ビルド間で安定（本番用）

### 永続キャッシュ

Webpack 5 はファイルシステムキャッシュを内蔵し、`hard-source-webpack-plugin` を置き換えました：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],  // 設定ファイルの変更時にキャッシュを無効化
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

実測結果：

```
# 初回ビルド
webpack 5.0.0-beta.16 compiled successfully in 8342ms

# 2回目のビルド（キャッシュヒット）
webpack 5.0.0-beta.16 compiled successfully in 1203ms
```

### より優れた Tree Shaking

Webpack 5 では、ネストされた Tree Shaking と内部モジュールの Tree Shaking が導入されました：

```js
// package.json
{
  "sideEffects": false  // パッケージ全体に副作用がないことをマーク
}

// または副作用のあるファイルを指定
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

Webpack 5 は CommonJS の Tree Shaking もサポートしています：

```js
// この記述方法でも Webpack 5 では Tree Shaking が可能
const { get } = require('lodash');
// lodash 全体ではなく、lodash.get だけがバンドルされる
```

### モジュールフェデレーション（Module Federation）

これは Webpack 5 で最も革新的な機能であり、実行時に他の独立したビルドのモジュールを動的にロードできます。

## Module Federationの深掘り

### コアコンセプト

Module Federation の核心的な考え方は、各ビルド成果物（bundle）がリモートモジュールを消費することも、自身のモジュールを他のビルド成果物に公開することもできるというものです。

主要な用語：

- **Host**：リモートモジュールを消費するビルド
- **Remote**：モジュールを公開し、他のビルドが使用できるようにするビルド
- **Shared**：複数のビルド間で共有される依存関係

### 基本設定

2つの独立したフロントエンドアプリケーションがあるとします：`app-shell`（メインアプリケーション）と `dashboard`（ダッシュボードアプリケーション）です。

**dashboard アプリケーション（Remote）がモジュールを公開：**

```js
// dashboard/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  output: {
    publicPath: 'http://localhost:3001/',
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: {
        // 公開するモジュールのパス：モジュール名
        './Widget': './src/components/Widget',
        './Chart': './src/components/Chart',
        './useDashboard': './src/hooks/useDashboard',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^16.8.0' },
        'react-dom': { singleton: true, requiredVersion: '^16.8.0' },
      },
    }),
  ],
};
```

**app-shell アプリケーション（Host）がモジュールを消費：**

```js
// app-shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_shell',
      remotes: {
        // リモートモジュール名: リモートコンテナ変数名@エントリURL
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^16.8.0' },
        'react-dom': { singleton: true, requiredVersion: '^16.8.0' },
      },
    }),
  ],
};
```

### コード内でリモートモジュールを使用

```jsx
// app-shell/src/App.jsx
import React, { Suspense, lazy } from 'react';

// リモートモジュールを動的インポート
const Widget = lazy(() => import('dashboard/Widget'));
const Chart = lazy(() => import('dashboard/Chart'));

function App() {
  return (
    <div>
      <h1>アプリケーションシェル</h1>
      <Suspense fallback={<div>ダッシュボードコンポーネントを読み込み中...</div>}>
        <Widget title="ユーザー統計" />
        <Chart type="line" data={chartData} />
      </Suspense>
    </div>
  );
}

export default App;
```

### 共有依存関係の設定

Shared 設定は、複数のビルド間での依存関係の共有方法を制御します：

```js
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,       // インスタンスを1つだけロード
      requiredVersion: '^16.8.0',
      eager: false,          // 遅延ロード（デフォルト）、エントリチャンクにバンドルしない
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^16.8.0',
    },
    // ワイルドカードも使用可能
    lodash: {
      singleton: false,      // 複数バージョンの共存を許可
    },
  },
});
```

設定オプションの説明：

| オプション | 説明 | デフォルト値 |
|-----------|------|-------------|
| `singleton` | インスタンスを1つだけロード | false |
| `requiredVersion` | バージョン要件 | package.json のバージョン |
| `eager` | エントリチャンクにバンドルするか | false |
| `strictVersion` | バージョン不一致時にエラーにするか | true |

### 複数 Remote の設定

1つのアプリケーションで複数の Remote を同時に消費できます：

```js
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
    checkout: 'checkout@http://localhost:3002/remoteEntry.js',
    auth: 'auth@http://localhost:3003/remoteEntry.js',
  },
});
```

### Remoteの動的読み込み

Remote のアドレスが動的な場合は、以下のように設定します：

```js
// 実行時にリモートモジュールを動的にロード
async function loadRemoteModule(url, scope, module) {
  // リモートエントリスクリプトをロード
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // 共有スコープを初期化
  await __webpack_init_sharing__('default');

  // リモートコンテナを取得
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // リモートモジュールを取得
  const factory = await container.get(module);
  return factory();
}

// 使用例
const Widget = await loadRemoteModule(
  'http://localhost:3001/remoteEntry.js',
  'dashboard',
  './Widget'
);
```

## 実際のアーキテクチャ方法

### マイクロフロントエンドアーキテクチャ

Module Federation はマイクロフロントエンドアーキテクチャの構築に非常に適しています：

```
┌─────────────────────────────────────────────┐
│               App Shell (Host)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Dashboard │ │  Orders  │ │  User Center │ │
│  │ (Remote)  │ │ (Remote) │ │   (Remote)   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│              共有: React, React DOM          │
└─────────────────────────────────────────────┘
```

各チームは自身の Remote モジュールを独立して開発・デプロイでき、App Shell がそれらを組み立てます。

### コンポーネントライブラリの共有

複数のプロジェクトが npm パッケージを公開せずにコンポーネントライブラリを共有できます：

```js
// shared-ui/webpack.config.js
new ModuleFederationPlugin({
  name: 'shared_ui',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/Button',
    './Modal': './src/Modal',
    './Table': './src/Table',
    './theme': './src/theme',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
```

## まとめ

- Webpack 5 の核心的な改善点：永続キャッシュ、決定論的モジュール ID、より優れた Tree Shaking
- Module Federation により、独立してビルドされたアプリケーションが実行時にモジュールを共有可能
- Host はリモートモジュールを消費し、Remote はモジュールを公開し、Shared は依存関係の共有を制御
- `singleton: true` は共有依存関係が1つのインスタンスのみロードされることを保証
- マイクロフロントエンドアーキテクチャやプロジェクト間のコンポーネント共有に非常に適している
- 動的ロードと複数 Remote 設定をサポート
- Webpack 5 の正式版は近日中にリリースされる見込み
