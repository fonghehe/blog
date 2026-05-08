---
title: "Webpack Bundle Analyzer 打包分析与优化"
date: 2019-08-07 15:09:22
tags:
  - Webpack
  - 工程化
---

项目上线后用户反馈首屏加载慢？打包产物体积过大是前端性能优化中最常见的瓶颈之一。`webpack-bundle-analyzer` 是一个可视化分析工具，能够以直观的树状图展示打包结果，帮助我们精准定位体积问题。本文将深入讲解如何使用它进行打包分析与优化。

## 安装与基本配置

```bash
npm install --save-dev webpack-bundle-analyzer
```

### 在 Webpack 配置中集成

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

### 通过 npm scripts 使用

更推荐不修改 Webpack 配置，而是通过命令行按需分析：

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

这样只在需要分析时才启动，不影响日常构建。

## 理解可视化报告

执行 `npm run analyze` 后，浏览器会自动打开报告页面。报告是一个交互式的树状图（Treemap），核心信息包括：

### 三种体积度量

- **Stat size** — 文件在磁盘上的原始大小（未经任何处理）
- **Parsed size** — 经过 Webpack 处理后的大小（包含 uglify/terser 压缩）
- **Gzip size** — 经过 gzip 压缩后的大小（更接近用户实际下载大小）

在实际优化中，我们应以 **Gzip size** 为基准衡量优化效果。

### 色块解读

每个色块代表一个模块或 chunk：

- 色块越大，体积越大
- 相同颜色的色块属于同一个 chunk
- 可以点击色块查看具体的依赖树

## 实战：排查体积过大问题

### 案例一：moment.js locale 文件全部打入

一个常见问题：`moment.js` 默认会将所有 locale 文件打包进来。

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

解决方案：使用 `IgnorePlugin` 只保留需要的 locale。

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

优化前后对比：moment 相关体积从约 270KB 降低到约 72KB。

### 案例二：lodash 全量引入

在报告中发现整个 lodash 库被完整引入，约 70KB。实际项目只用到了 `debounce`、`get`、`cloneDeep` 几个方法。

解决方案一：使用 lodash-es 配合 tree shaking

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

解决方案二：使用 babel-plugin-import 或手动按需引入

```js
// 直接引入具体模块
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';
```

优化前后对比：lodash 相关体积从 70KB 降低到约 8KB。

### 案例三：重复依赖

报告中发现了多个不同版本的相同库。例如 `axios` 出现了两次，因为不同的第三方组件各自打包了一份。

解决方案：

```json
{
  "resolutions": {
    "axios": "0.19.0"
  }
}
```

在 `package.json` 中使用 `resolutions`（Yarn）强制所有依赖使用同一版本。

也可以通过 Webpack 的 `resolve.alias` 统一：

```js
module.exports = {
  resolve: {
    alias: {
      axios: path.resolve(__dirname, 'node_modules/axios'),
    },
  },
};
```

## 进阶优化策略

### 1. 使用 externals 排除公共库

对于 CDN 引入的库，应该在 Webpack 中配置 externals，避免重复打包：

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

### 2. 配置 splitChunks 精细控制

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

### 3. 使用动态 import 拆分路由

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

### 4. 分析 CSS 体积

CSS 文件也值得关注。如果使用了 `mini-css-extract-plugin`，可以查看 CSS 的体积分布：

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

## 自动化体积监控

为了防止体积回退，可以在 CI 中加入体积检查：

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

## 小结

- `webpack-bundle-analyzer` 以可视化方式展示打包产物，是定位体积问题的首选工具
- 关注 Gzip size 而非 Stat size，它更接近用户实际下载量
- 常见体积问题：moment locale 全量打包、lodash 全量引入、重复依赖
- 使用 `IgnorePlugin`、`externals`、`splitChunks` 等手段可以显著降低 bundle 体积
- 建议在 CI 流程中加入体积监控，防止优化成果回退
- 定期使用 analyzer 扫描项目，新引入的第三方库往往是体积增长的主要原因
