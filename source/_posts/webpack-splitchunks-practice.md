---
title: "Webpack 公共代码提取和 SplitChunks"
date: 2018-10-25 10:34:15
tags:
  - Webpack
  - 工程化
---

随着项目页面增多，多个页面都用到的代码会被重复打包。`SplitChunks` 可以把公共代码提取出来，让浏览器缓存复用。

## 为什么需要代码分割

```
项目有 A、B、C 三个页面，都用了 lodash 和 Vue
如果不提取：
  pageA.js = pageA代码 + lodash + Vue
  pageB.js = pageB代码 + lodash + Vue
  pageC.js = pageC代码 + lodash + Vue
  → lodash 和 Vue 被下载了 3 次！

提取后：
  vendor.js = lodash + Vue（只下载一次，长期缓存）
  common.js = A/B/C 共用的业务代码
  pageA.js = pageA 自己的代码（很小）
```

## Webpack 4 的 SplitChunks

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 对所有 chunks 生效（async/initial/all）

      cacheGroups: {
        // 第三方库单独打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 20,
        },

        // 公共业务代码
        common: {
          name: "common",
          minChunks: 2, // 至少被 2 个 chunk 引用
          chunks: "all",
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## 更细粒度的分割

```javascript
cacheGroups: {
  // Vue 框架单独打包（很少变化，长期缓存）
  vue: {
    test: /[\\/]node_modules[\\/](vue|vue-router|vuex)[\\/]/,
    name: 'vue',
    chunks: 'all',
    priority: 30
  },

  // Element UI 单独打包（比较大，单独缓存）
  elementUI: {
    test: /[\\/]node_modules[\\/]element-ui[\\/]/,
    name: 'element-ui',
    chunks: 'all',
    priority: 25
  },

  // 其他第三方库
  vendors: {
    test: /[\\/]node_modules[\\/]/,
    name: 'vendors',
    chunks: 'all',
    priority: 20
  },

  // 项目公共代码
  common: {
    name: 'common',
    minChunks: 2,
    chunks: 'all',
    priority: 10
  }
}
```

## runtime chunk

```javascript
optimization: {
  // 把 webpack 的运行时代码单独提取
  // 避免 vendor hash 因为 runtime 变化而改变
  runtimeChunk: {
    name: "runtime";
  }
}
```

## 缓存策略配合

```javascript
output: {
  // contenthash：内容不变则 hash 不变，浏览器可以长期缓存
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

分割策略：

```
runtime.js    → 很小，每次构建可能变化
vendor.js     → 第三方库，几乎不变，长期缓存
common.js     → 业务公共代码，偶尔变化
pageA.js      → 页面代码，经常变化
```

## Vue CLI 的默认配置

Vue CLI 已经做了合理的默认配置，通常不需要手动改：

```javascript
// vue.config.js（只在默认不满足需求时调整）
module.exports = {
  chainWebpack(config) {
    config.optimization.splitChunks({
      cacheGroups: {
        vendors: {
          name: "chunk-vendors",
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: "initial",
        },
      },
    });
  },
};
```

## 效果

在我们的项目里，分割优化后：

```
优化前：
  app.js：1.2MB（首次和后续每页都要下载）

优化后：
  vendor.js：600KB（首次下载，后续所有页面缓存复用）
  common.js：100KB
  各页面 chunk：30-80KB

首次总量差不多，但后续页面跳转只需要下载 page chunk
```

## 小结

- `splitChunks.chunks: 'all'` 对所有代码生效
- `cacheGroups` 定义不同的提取策略
- 第三方库按频率分组：核心框架、大型UI库、其他
- `contenthash` 确保缓存在内容不变时有效
- Vue CLI 有合理默认值，先跑 bundle analyzer 再决定要不要调整
