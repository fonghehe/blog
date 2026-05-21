---
title: "Webpack 3 代码分割与懒加载实战"
date: 2018-01-04 17:02:09
tags:
  - Webpack
  - 工程化
readingTime: 3
description: "单页应用做大了之后，打包体积是个绕不过去的问题。我们的项目上线后首屏 JS 一度达到 1.8MB，用户在 3G 网络下等待时间超过 8 秒。这篇文章记录用 Webpack 3 的代码分割做优化的过程。"
wordCount: 580
---

单页应用做大了之后，打包体积是个绕不过去的问题。我们的项目上线后首屏 JS 一度达到 1.8MB，用户在 3G 网络下等待时间超过 8 秒。这篇文章记录用 Webpack 3 的代码分割做优化的过程。

## 问题诊断

先用 `webpack-bundle-analyzer` 看清楚包里有什么：

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

跑完之后会打开一个可视化页面，方块大小代表体积占比。我们发现问题：

- `moment.js` 把所有语言包都打进去了，占了 200KB+
- `echarts` 全量引入，其实只用了折线图
- 几个只在特定页面用到的富文本编辑器被打进了主包

## 入口分割：提取公共依赖

```javascript
// webpack.config.js
module.exports = {
  entry: {
    app: "./src/main.js",
    vendor: ["vue", "vue-router", "vuex", "axios"],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      minChunks: Infinity,
    }),
  ],
};
```

这样 `vendor` 包含第三方库，`manifest` 包含 webpack 运行时，业务代码变更不会影响 vendor 的缓存。

## 动态 import：路由级懒加载

这是效果最明显的优化。把路由组件改成动态导入：

```javascript
// router/index.js

// 之前
import Dashboard from "@/views/Dashboard";
import UserProfile from "@/views/UserProfile";
import OrderList from "@/views/OrderList";

// 之后
const Dashboard = () => import("@/views/Dashboard");
const UserProfile = () => import("@/views/UserProfile");
const OrderList = () => import("@/views/OrderList");

const routes = [
  { path: "/dashboard", component: Dashboard },
  { path: "/profile", component: UserProfile },
  { path: "/orders", component: OrderList },
];
```

Webpack 遇到动态 `import()` 会自动生成独立的 chunk。用户只有访问对应路由时才会加载那个 chunk。

## 魔法注释：给 chunk 命名

```javascript
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserSettings");
```

同名的 `webpackChunkName` 会被合并成一个 chunk。把功能相关的页面放在同一个 chunk，减少网络请求次数。

## 组件级懒加载

不只是路由，组件也可以懒加载：

```javascript
export default {
  components: {
    // 只有渲染到这个组件时才加载
    RichEditor: () => import("@/components/RichEditor"),

    // 带 loading 和 error 状态
    DataChart: () => ({
      component: import("@/components/DataChart"),
      loading: LoadingSpinner,
      error: ErrorComponent,
      delay: 200, // 200ms 后显示 loading
      timeout: 10000, // 10s 后显示 error
    }),
  },
};
```

## moment.js 体积问题

moment 默认打包所有语言包，用 `IgnorePlugin` 排除：

```javascript
// webpack.config.js
plugins: [new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)];
```

然后在需要的地方手动引入中文包：

```javascript
import moment from "moment";
import "moment/locale/zh-cn";
moment.locale("zh-cn");
```

光这一步就减少了约 170KB（gzip 后约 40KB）。

## 优化结果

| 优化项      | 之前       | 之后            |
| 
----------- | ---------- | --------------- |
| 主包大小    | 1.8MB      | 420KB           |
| vendor 包   | 合并在主包 | 680KB（强缓存） |
| 首屏加载 JS | 1.8MB      | 420KB           |
| 3G 首屏时间 | 8.2s       | 2.1s            |

vendor 包虽然本身更大，但因为命中了浏览器缓存，二次访问几乎不需要重新加载。

## 注意事项

代码分割粒度不是越细越好。每个 chunk 是一个额外的 HTTP 请求，太细反而会因为并发请求数量和 HTTP overhead 拖慢速度。HTTP/2 多路复用能缓解这个问题，但老项目一般还在 HTTP/1.1 上。

经验值：单个按需 chunk 小于 20KB（gzip 后）基本没必要单独分割。

---

_下一篇：CSS Grid 布局入门指南_
