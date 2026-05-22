---
title: "Webpack Bundle Analyzer 打包分析與最佳化"
date: 2019-08-07 15:09:22
tags:
  - Webpack
  - 工程化
readingTime: 4
description: "專案上線後用戶反饋首屏載入慢？打包產物體積過大是前端效能最佳化中最常見的瓶頸之一。`webpack-bundle-analyzer` 是一個視覺化分析工具，能夠以直觀的樹狀圖展示打包結果，幫助我們精準定位體積問題。本文將深入講解如何使用它進行打包分析與最佳化。"
wordCount: 858
---

專案上線後用戶反饋首屏載入慢？打包產物體積過大是前端效能最佳化中最常見的瓶頸之一。`webpack-bundle-analyzer` 是一個視覺化分析工具，能夠以直觀的樹狀圖展示打包結果，幫助我們精準定位體積問題。本文將深入講解如何使用它進行打包分析與最佳化。

## 安裝與基本設定

```bash
npm install --save-dev webpack-bundle-analyzer
```

### 在 Webpack 設定中整合

```js
// webpack.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      // 執行模式：server / static / json
      analyzerMode: 'server',
      // 分析伺服器埠
      analyzerPort: 8888,
      // 是否在打包後自動開啟瀏覽器
      openAnalyzer: true,
      // 生成的報告檔名（static 和 json 模式）
      reportFilename: 'report.html',
      // 模組大小計算方式：stat / parsed / gzip
      defaultSizes: 'parsed',
    }),
  ],
};
```

### 通過 npm scripts 使用

更推薦不修改 Webpack 設定，而是通過命令列按需分析：

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

這樣隻在需要分析時才啟動，不影響日常構建。

## 理解視覺化報告

執行 `npm run analyze` 後，瀏覽器會自動開啟報告頁面。報告是一個互動式的樹狀圖（Treemap），核心資訊包括：

### 三種體積度量

- **Stat size** — 檔案在磁碟上的原始大小（未經任何處理）
- **Parsed size** — 經過 Webpack 處理後的大小（包含 uglify/terser 壓縮）
- **Gzip size** — 經過 gzip 壓縮後的大小（更接近使用者實際下載大小）

在實際最佳化中，我們應以 **Gzip size** 為基準衡量最佳化效果。

### 色塊解讀

每個色塊代表一個模組或 chunk：

- 色塊越大，體積越大
- 相同顏色的色塊屬於同一個 chunk
- 可以點選色塊檢視具體的依賴樹

## 實戰：排查體積過大問題

### 案例一：moment.js locale 檔案全部打入

一個常見問題：`moment.js` 預設會將所有 locale 檔案打包進來。

```
檢查報告中 moment 目錄：
  moment/
  ├── moment.js          (約 70KB)
  ├── locale/
  │   ├── zh-cn.js       (約 2KB)
  │   ├── en-gb.js       (約 2KB)
  │   ├── ...             (共 100+ 個 locale 檔案)
  │   └── (總計約 200KB+)
```

解決方案：使用 `IgnorePlugin` 隻保留需要的 locale。

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

// 在程式碼中手動引入需要的 locale
import moment from 'moment';
import 'moment/locale/zh-cn';

moment.locale('zh-cn');
```

最佳化前後對比：moment 相關體積從約 270KB 降低到約 72KB。

### 案例二：lodash 全量引入

在報告中發現整個 lodash 庫被完整引入，約 70KB。實際專案隻用到了 `debounce`、`get`、`cloneDeep` 幾個方法。

解決方案一：使用 lodash-es 配合 tree shaking

```js
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      // 將 lodash 對映到 lodash-es，支援 ES modules 和 tree shaking
      'lodash': 'lodash-es',
    },
  },
};

// 原始碼中按需引入
import { debounce, get, cloneDeep } from 'lodash';
```

解決方案二：使用 babel-plugin-import 或手動按需引入

```js
// 直接引入具體模組
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
```

最佳化前後對比：lodash 相關體積從 70KB 降低到約 8KB。

### 案例三：重複依賴

報告中發現了多個不同版本的相同庫。例如 `axios` 出現了兩次，因為不同的第三方元件各自打包了一份。

解決方案：

```json
{
  "resolutions": {
    "axios": "0.19.0"
  }
}
```

在 `package.json` 中使用 `resolutions`（Yarn）強製所有依賴使用同一版本。

也可以通過 Webpack 的 `resolve.alias` 統一：

```js
module.exports = {
  resolve: {
    alias: {
      axios: path.resolve(__dirname, 'node_modules/axios'),
    },
  },
};
```

## 進階最佳化策略

### 1. 使用 externals 排除公共庫

對於 CDN 引入的庫，應該在 Webpack 中配置 externals，避免重複打包：

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
<!-- 在 HTML 中通過 CDN 引入 -->
<script src="https://unpkg.com/react@16/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@16/umd/react-dom.production.min.js"></script>
```

### 2. 設定 splitChunks 精細控製

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
            // 將每個 npm 包拆分成獨立 chunk，便於快取
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

### 3. 使用動態 import 拆分路由

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

### 4. 分析 CSS 體積

CSS 檔案也值得關注。如果使用了 `mini-css-extract-plugin`，可以檢視 CSS 的體積分佈：

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

## 自動化體積監控

為了防止體積回退，可以在 CI 中加入體積檢查：

```js
// scripts/check-bundle-size.js
const fs = require('fs');
const path = require('path');
const gzipSize = require('gzip-size');

const BUILD_DIR = path.resolve(__dirname, '../build/static/js');
const MAX_SIZE_KB = 250; // 主 bundle 最大 250KB (gzip)

const files = fs.readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));

let failed = false;
files.forEach(file => {
  const content = fs.readFileSync(path.join(BUILD_DIR, file));
  const size = gzipSize.sync(content);
  const sizeKB = (size / 1024).toFixed(2);

  console.log(`${file}: ${sizeKB}KB (gzip)`);

  if (file.includes('main') && size > MAX_SIZE_KB * 1024) {
    console.error(`主 bundle 超過 ${MAX_SIZE_KB}KB 限製！`);
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

## 小結

- `webpack-bundle-analyzer` 以視覺化方式展示打包產物，是定位體積問題的首選工具
- 關注 Gzip size 而非 Stat size，它更接近使用者實際下載量
- 常見體積問題：moment locale 全量打包、lodash 全量引入、重複依賴
- 使用 `IgnorePlugin`、`externals`、`splitChunks` 等手段可以顯著降低 bundle 體積
- 建議在 CI 流程中加入體積監控，防止最佳化成果回退
- 定期使用 analyzer 掃描專案，新引入的第三方庫往往是體積增長的主要原因
