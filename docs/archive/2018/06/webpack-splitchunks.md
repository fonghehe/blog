---
title: "Webpack splitChunks 代码分割实战"
date: 2018-06-09 16:08:30
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 4 用 `splitChunks` 替代了之前的 `CommonsChunkPlugin`，配置更简单。记录一下实际项目里的配置。"
wordCount: 269
---

Webpack 4 用 `splitChunks` 替代了之前的 `CommonsChunkPlugin`，配置更简单。记录一下实际项目里的配置。

## 为什么要代码分割

不分割的情况下，所有代码打成一个 `main.js`，用户每次访问都需要加载整个文件，即使大部分页面他用不到。

代码分割后：

- 公共库（vue、lodash）单独打包，利用浏览器缓存
- 路由对应的页面按需加载
- 首屏只加载必要代码

## 路由懒加载（最简单的分割）

```javascript
// router/index.js
const routes = [
  {
    path: "/dashboard",
    component: () =>
      import(/* webpackChunkName: "dashboard" */ "../views/Dashboard.vue"),
  },
  {
    path: "/users",
    component: () =>
      import(/* webpackChunkName: "users" */ "../views/Users.vue"),
  },
];
```

`/* webpackChunkName: "xxx" */` 注释可以给分割出的 chunk 起名字，便于分析。

## splitChunks 配置

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 对所有 chunk 生效（包括异步和同步）
      cacheGroups: {
        // 第三方依赖单独打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
          chunks: "all",
        },
        // Element UI 单独打包（体积大，变动少）
        elementUI: {
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          name: "element-ui",
          priority: 20, // 优先级高于 vendors
          chunks: "all",
        },
        // 被多个 chunk 共用的代码
        common: {
          minChunks: 2, // 至少被 2 个 chunk 引用
          name: "common",
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    // 运行时代码单独提取
    runtimeChunk: {
      name: "runtime",
    },
  },
};
```

## Vue CLI 3 中的配置

```javascript
// vue.config.js
module.exports = {
  chainWebpack: (config) => {
    config.optimization.splitChunks({
      chunks: "all",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: -10,
          chunks: "all",
        },
      },
    });
  },
};
```

## 分析打包结果

安装 `webpack-bundle-analyzer` 看看分割效果：

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

## HTML 中的 preload/prefetch

Vue CLI 3 会自动为懒加载的 chunk 生成 `<link rel="prefetch">` 标签，浏览器空闲时预加载：

```html
<!-- 自动生成 -->
<link rel="prefetch" href="/js/dashboard.js" />
<link rel="prefetch" href="/js/users.js" />
```

## 小结

- 路由懒加载是最简单的代码分割方式，一行代码
- `splitChunks.cacheGroups` 控制如何分组
- 第三方库单独打包，充分利用浏览器缓存
- 用 bundle analyzer 确认分割效果
