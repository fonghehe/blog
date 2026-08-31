---
title: "Webpack Bundle Analyzer: Bundle Analysis and Optimization"
date: 2019-08-07 15:09:22
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "After launch, users complain the first paint is slow? Oversized bundles are one of the most common front-end performance bottlenecks. `webpack-bundle-analyzer` is a visualization tool that shows your build output as an intuitive treemap, helping you pinpoint size problems precisely. This article goes deep on how to use it for bundle analysis and optimization."
wordCount: 521
---

After launch, users complain the first paint is slow? Oversized bundles are one of the most common front-end performance bottlenecks. `webpack-bundle-analyzer` is a visualization tool that shows your build output as an intuitive treemap, helping you pinpoint size problems precisely. This article goes deep on how to use it for bundle analysis and optimization.

## Installation and Basic Configuration

```bash
npm install --save-dev webpack-bundle-analyzer
```

### Integrating into the Webpack Config

```js
// webpack.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      // 运行模式：server / static / json
      analyzerMode: 'server',
      // 分析服务器端口
      analyzerPort: 8888,
      // 是否在打包后自动打开浏览器
      openAnalyzer: true,
      // 生成的报告文件名（static 和 json 模式）
      reportFilename: 'report.html',
      // 模块大小计算方式：stat / parsed / gzip
      defaultSizes: 'parsed',
    }),
  ],
};
```

### Using via npm Scripts

A cleaner approach is to avoid touching the Webpack config and run analysis on demand from the CLI:

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

That way it only runs when you actually need it, leaving everyday builds untouched.

## Understanding the Visual Report

After running `npm run analyze`, the browser opens the report automatically. The report is an interactive treemap, and its core information includes:

### Three Size Metrics

- **Stat size** — the raw size of the file on disk (before any processing).
- **Parsed size** — the size after Webpack processes it (including uglify/terser minification).
- **Gzip size** — the size after gzip compression (closest to what users actually download).

When optimizing, you should measure progress against **Gzip size**.

### Reading the Treemap

Each block represents a module or a chunk:

- The bigger the block, the larger the module.
- Blocks of the same color belong to the same chunk.
- Click a block to see its specific dependency tree.

## In Practice: Diagnosing Oversized Bundles

### Case 1: All moment.js Locale Files Bundled

A common issue: by default `moment.js` bundles every locale file.

```
检查报告中 moment 目录：
  moment/
  ├── moment.js          (约 70KB)
  ├── locale/
  │   ├── zh-cn.js       (约 2KB)
  │   ├── en-gb.js       (约 2KB)
  │   ├── ...             (共 100+ 个 locale 文件)
  │   └── (总计约 200KB+)
```

Solution: use `IgnorePlugin` to keep only the locales you need.

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

// 在代码中手动引入需要的 locale
import moment from 'moment';
import 'moment/locale/zh-cn';

moment.locale('zh-cn');
```

Before and after: moment-related size dropped from about 270KB to about 72KB.

### Case 2: Importing All of lodash

The report shows the entire lodash library pulled in—about 70KB—even though the project only uses a few methods like `debounce`, `get`, and `cloneDeep`.

Solution 1: use lodash-es with tree shaking

```js
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      // 将 lodash 映射到 lodash-es，支持 ES modules 和 tree shaking
      'lodash': 'lodash-es',
    },
  },
};

// 源码中按需引入
import { debounce, get, cloneDeep } from 'lodash';
```

Solution 2: use babel-plugin-import or import manually on demand

```js
// 直接引入具体模块
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
```

Before and after: lodash-related size dropped from 70KB to about 8KB.

### Case 3: Duplicate Dependencies

The report shows multiple versions of the same library. For example, `axios` appears twice because different third-party components each bundled their own copy.

Solution:

```json
{
  "resolutions": {
    "axios": "0.19.0"
  }
}
```

In `package.json`, use `resolutions` (Yarn) to force every dependency to use the same version.

You can also unify them through Webpack's `resolve.alias`:

```js
module.exports = {
  resolve: {
    alias: {
      axios: path.resolve(__dirname, 'node_modules/axios'),
    },
  },
};
```

## Advanced Optimization Strategies

### 1. Excluding Common Libraries with externals

For libraries loaded via CDN, configure `externals` in Webpack so they aren't bundled again:

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

### 2. Fine-Grained splitChunks Configuration

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
            // 将每个 npm 包拆分成独立 chunk，便于缓存
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

### 3. Splitting Routes with Dynamic import

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

### 4. Analyzing CSS Size

CSS files are worth watching too. If you use `mini-css-extract-plugin`, you can inspect how CSS size is distributed:

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

## Automated Bundle Size Monitoring

To prevent size regressions, add a size check to your CI pipeline:

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
    console.error(`主 bundle 超过 ${MAX_SIZE_KB}KB 限制！`);
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

## Summary

- `webpack-bundle-analyzer` visualizes your build output and is the go-to tool for locating size problems.
- Focus on Gzip size rather than Stat size—it's closer to what users actually download.
- Common size problems: bundling all moment locales, importing all of lodash, and duplicate dependencies.
- Tools like `IgnorePlugin`, `externals`, and `splitChunks` can significantly shrink your bundle.
- Add size monitoring to CI to stop optimization wins from regressing.
- Scan the project with the analyzer regularly; a newly added third-party library is often the main cause of size growth.
