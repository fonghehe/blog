---
title: "Webpack 5 Beta 新機能プレビュー"
date: 2020-02-06 11:01:12
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Webpack 5 已经进入 Beta 阶段，虽然还没正式发布，但新特性值得关注。梳理一下对我们日常开发影响最大的几个变化。"
wordCount: 429
---

Webpack 5 はすでに Beta 段階に入っている。正式リリースはまだだが、新機能は注目に値する。日常の開発に最も影響するいくつかの変更を整理する。

## Module Federation：微前端的官方解法

これは Webpack 5 最大の目玉機能で、独立してビルドされた複数のアプリケーション間でモジュールを共有できる：

```javascript
// app1/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      filename: 'remoteEntry.js',
      exposes: {
        // 暴露组件给其他应用使用
        './Button': './src/components/Button',
        './utils': './src/utils/helpers',
      },
      shared: {
        vue: { singleton: true },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// app2/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app2',
      remotes: {
        app1: 'app1@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        vue: { singleton: true },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// app2 中使用 app1 的组件
const Button = () => import('app1/Button');
```

これにより、マイクロフロントエンドに iframe や single-spa のような重い仕組みは不要になる。

## 持久化缓存

Webpack 5 には永続キャッシュが組み込まれており、`hard-source-webpack-plugin` は不要になる：

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // 配置文件变更时失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

実測：2 回目のビルド時間が 45 秒から 8 秒に短縮された。

## 资源模块 (Asset Modules)

リソース処理が組み込まれ、`file-loader`、`url-loader`、`raw-loader` は不要になる：

```javascript
// Webpack 4
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 8192 },
          },
        ],
      },
    ],
  },
};

// Webpack 5
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset', // 自动选择 inline 或 external
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
      },
      {
        test: /\.txt$/,
        type: 'asset/source', // 相当于 raw-loader
      },
      {
        test: /\.svg$/,
        type: 'asset/resource', // 相当于 file-loader
      },
    ],
  },
};
```

## Tree Shaking 增强

```javascript
// package.json 中声明 sideEffects
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}

// Webpack 5 新增：
// 1. 嵌套 tree shaking：连嵌套模块的导出也能分析
// 2. 内部模块 tree shaking：模块内部的导出也能被 shake
// 3. CommonJS tree shaking：对 CommonJS 也生效（部分场景）

// 新增 optimization.usedExports 和 innerGraph
module.exports = {
  optimization: {
    usedExports: true,
    innerGraph: true, // 新：分析模块内部的依赖图
  },
};
```

## 最小 Node.js 版本

Webpack 5 は Node.js >= 10.13.0 を要求する。アップグレード前に CI 環境を確認しておくこと。

## 迁移注意事项

```bash
# 升级命令
npm install webpack@next webpack-cli@latest -D

# 需要同步升级的插件
npm install -D webpack-dev-server@latest html-webpack-plugin@next

# 可能需要移除的（已内置）
npm uninstall file-loader url-loader raw-loader hard-source-webpack-plugin
```

```javascript
// 常见报错及修复
// 1. Buffer 不再 polyfill
// 需要手动安装 buffer
resolve: {
  fallback: {
    buffer: require.resolve('buffer/'),
  },
}

// 2. process 不再 polyfill
// 安装 process/browser
resolve: {
  fallback: {
    process: require.resolve('process/browser'),
  },
}
```

## まとめ

- Module Federation はマイクロフロントエンドにおける大きな飛躍であり、深掘りする価値がある
- 永続キャッシュは 2 回目のビルド時間を大幅に短縮する
- Asset Modules はリソース処理の設定を簡略化する
- Tree Shaking がより賢明になり、出力が小さくなる
- Node.js の最小バージョン要件が 10.13.0 に引き上がるため、アップグレード前に環境を確認する
