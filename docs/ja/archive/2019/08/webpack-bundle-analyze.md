---
title: "Webpack Bundle Analyzer：バンドル分析と最適化"
date: 2019-08-07 15:09:22
tags:
  - Webpack
  - エンジニアリング
readingTime: 6
description: "プロジェクト公開後にユーザーから初期ロードが遅いというフィードバックを受けたことはないだろうか。バンドル成果物のサイズ過大は、フロントエンドのパフォーマンス最適化で最も一般的なボトルネックの一つだ。`webpack-bundle-analyzer` はビジュアル分析ツールで、直感的なツリーマップでバンドル結果を表示し、サイズ問題の正確な特定を支援する。本記事ではこれを使ったバンドル分析と最適化の方法を詳しく解説する。"
wordCount: 1298
---

プロジェクト公開後にユーザーから初期ロードが遅いというフィードバックを受けたことはないだろうか。バンドル成果物のサイズ過大は、フロントエンドのパフォーマンス最適化で最も一般的なボトルネックの一つだ。`webpack-bundle-analyzer` はビジュアル分析ツールで、直感的なツリーマップでバンドル結果を表示し、サイズ問題の正確な特定を支援する。本記事ではこれを使ったバンドル分析と最適化の方法を詳しく解説する。

## インストールと基本設定

```bash
npm install --save-dev webpack-bundle-analyzer
```

### Webpack設定への統合

```js
// webpack.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      // 実行モード：server / static / json
      analyzerMode: 'server',
      // 分析サーバーのポート
      analyzerPort: 8888,
      // バンドル後にブラウザを自動で開くかどうか
      openAnalyzer: true,
      // 生成されるレポートファイル名（staticおよびjsonモード）
      reportFilename: 'report.html',
      // モジュールサイズの計算方法：stat / parsed / gzip
      defaultSizes: 'parsed',
    }),
  ],
};
```

### npm scriptsでの使用

Webpack設定を変更せず、コマンドラインで必要に応じて分析する方法をより推奨する：

```json
{
  "scripts": {
    "build": "webpack --config webpack.prod.js",
    "analyze": "ANALYZE=true webpack --config webpack.prod.js"
  }
}
```

```js
// webpack.config.js
if (process.env.ANALYZE) {
  config.plugins.push(new BundleAnalyzerPlugin());
}
```

これで分析が必要な時だけ起動し、通常のビルドに影響しない。

## 可視化レポートの理解

`npm run analyze` を実行すると、ブラウザが自動的にレポートページを開く。レポートはインタラクティブなツリーマップ（Treemap）で、以下のコア情報が含まれる：

### 3つのサイズ指標

- **Stat size** — ディスク上の元のファイルサイズ（未処理）
- **Parsed size** — Webpack処理後のサイズ（uglify/terser圧縮込み）
- **Gzip size** — gzip圧縮後のサイズ（ユーザーの実際のダウンロードサイズに近い）

実際の最適化では、**Gzip size** を基準に最適化効果を測定すべきである。

### カラーブロックの解釈

各カラーブロックはモジュールまたはチャンクを表す：

- ブロックが大きいほどサイズが大きい
- 同じ色のブロックは同じチャンクに属する
- ブロックをクリックすると依存関係ツリーを確認できる

## 実践：バンドルサイズ超過の調査

### ケース1：moment.jsのロケールファイルがすべてバンドルされる

よくある問題：`moment.js` はデフォルトで全てのロケールファイルをバンドルしてしまう。

```
レポートのmomentディレクトリを確認：
  moment/
  ├── moment.js          (約70KB)
  ├── locale/
  │   ├── zh-cn.js       (約2KB)
  │   ├── en-gb.js       (約2KB)
  │   ├── ...             (合計100以上のロケールファイル)
  │   └── (合計約200KB以上)
```

解決策：`IgnorePlugin` を使って必要なロケールのみ保持する。

```js
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  ],
};

// コード内で必要なロケールを手動インポート
import moment from 'moment';
import 'moment/locale/zh-cn';

moment.locale('zh-cn');
```

最適化前後の比較：moment関連のサイズが約270KBから約72KBに削減。

### ケース2：lodashのフルインポート

レポートでlodashライブラリ全体がインポートされており、約70KBであることが判明。実際のプロジェクトでは `debounce`、`get`、`cloneDeep` 程度のメソッドしか使っていない。

解決策1：lodash-esを使ってtree shakingを活用

```js
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      // lodashをlodash-esにマッピングし、ES modulesとtree shakingをサポート
      'lodash': 'lodash-es',
    },
  },
};

// ソースコードでオンデマンドインポート
import { debounce, get, cloneDeep } from 'lodash';
```

解決策2：babel-plugin-importを使うか手動でオンデマンドインポート

```js
// 具体的なモジュールを直接インポート
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
```

最適化前後の比較：lodash関連のサイズが70KBから約8KBに削減。

### ケース3：重複依存

レポートで同じライブラリの異なるバージョンが複数見つかった。たとえば `axios` が2回登場しており、異なるサードパーティコンポーネントがそれぞれ独自にバンドルしているためだ。

解決策：

```json
{
  "resolutions": {
    "axios": "0.19.0"
  }
}
```

`package.json` で `resolutions`（Yarn）を使い、すべての依存を同一バージョンに強制する。

Webpackの `resolve.alias` で統一することもできる：

```js
module.exports = {
  resolve: {
    alias: {
      axios: path.resolve(__dirname, 'node_modules/axios'),
    },
  },
};
```

## 高度な最適化戦略

### 1. externalsで共通ライブラリを除外

CDNで読み込むライブラリについては、Webpackでexternalsを設定して重複バンドルを避けるべきだ：

```js
// webpack.config.js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    moment: 'moment',
  },
};
```

```html
<!-- 在 HTML 中通过 CDN 引入 -->
<script src="https://unpkg.com/react@16/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@16/umd/react-dom.production.min.js"></script>
```

### 2. splitChunksの詳細設定

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 20,
      minSize: 0,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // 各npmパッケージを独立したチャンクに分割し、キャッシュを容易にする
            const packageName = module.context.match(
              /[\\/]node_modules[\\/](.*?)([\\/]|$)/
            )[1];
            return `vendor.${packageName.replace('@', '')}`;
          },
          priority: 10,
        },
      },
    },
  },
};
```

### 3. 動的importでルートを分割

```jsx
const Dashboard = React.lazy(() => import(
  /* webpackChunkName: "dashboard" */
  './pages/Dashboard'
));

const Settings = React.lazy(() => import(
  /* webpackChunkName: "settings" */
  './pages/Settings'
));
```

### 4. CSSサイズの分析

CSSファイルも注目すべきだ。`mini-css-extract-plugin` を使用している場合、CSSのサイズ分布を確認できる：

```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
};
```

## バンドルサイズの自動監視

サイズの逆行を防ぐため、CIにサイズチェックを組み込める：

```js
// scripts/check-bundle-size.js
const fs = require('fs');
const path = require('path');
const gzipSize = require('gzip-size');

const BUILD_DIR = path.resolve(__dirname, '../build/static/js');
const MAX_SIZE_KB = 250; // メインバンドル最大250KB（gzip）

const files = fs.readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));

let failed = false;
files.forEach(file => {
  const content = fs.readFileSync(path.join(BUILD_DIR, file));
  const size = gzipSize.sync(content);
  const sizeKB = (size / 1024).toFixed(2);

  console.log(`${file}: ${sizeKB}KB (gzip)`);

  if (file.includes('main') && size > MAX_SIZE_KB * 1024) {
    console.error(`メインバンドルが${MAX_SIZE_KB}KBの制限を超過！`);
    failed = true;
  }
});

if (failed) {
  process.exit(1);
}
```

```json
{
  "scripts": {
    "build": "webpack --config webpack.prod.js",
    "check-size": "node scripts/check-bundle-size.js",
    "ci": "npm run build && npm run check-size"
  }
}
```

## まとめ

- `webpack-bundle-analyzer` はバンドル成果物をビジュアルで表示し、サイズ問題の特定に最適なツールである
- Stat sizeではなくGzip sizeに注目する。ユーザーの実際のダウンロード量に近い
- よくあるサイズ問題：momentロケールのフルバンドル、lodashのフルインポート、重複依存
- `IgnorePlugin`・`externals`・`splitChunks` などを活用することでバンドルサイズを大幅に削減できる
- CIパイプラインにサイズ監視を組み込み、最適化成果の逆行を防ぐことを推奨する
- 定期的にanalyzerでプロジェクトをスキャンする。新しく追加したサードパーティライブラリがサイズ増加の主因となることが多い
