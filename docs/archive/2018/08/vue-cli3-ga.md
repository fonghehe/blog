---
title: "Vue CLI 3 正式版：深度使用指南"
date: 2018-08-11 10:57:54
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3.0 正式版（GA）发布了，正式从 Beta 阶段毕业。比 Beta 版稳定了很多，可以在生产项目使用了。"
wordCount: 170
---

Vue CLI 3.0 正式版（GA）发布了，正式从 Beta 阶段毕业。比 Beta 版稳定了很多，可以在生产项目使用了。

## 项目结构对比

```
CLI 2 项目结构：
├── build/                  ← webpack 配置文件
│   ├── webpack.base.conf.js
│   ├── webpack.dev.conf.js
│   └── webpack.prod.conf.js
├── config/                 ← 环境变量配置
├── src/
└── package.json

CLI 3 项目结构：
├── src/
├── public/                 ← 不经过 webpack 的静态资源
├── vue.config.js           ← 可选，所有配置在这一个文件
└── package.json
```

webpack 配置完全内化，项目目录清爽很多。

## vue.config.js 完整示例

```javascript
const path = require("path");

module.exports = {
  // 部署路径
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 输出目录
  outputDir: "dist",

  // 静态资源目录（相对 outputDir）
  assetsDir: "static",

  // 开发服务器
  devServer: {
    port: 8080,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },

  // CSS 相关
  css: {
    loaderOptions: {
      sass: {
        // 全局注入变量，每个 vue 文件不需要手动 import
        prependData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // 修改 webpack 配置
  chainWebpack: (config) => {
    // 修改 html-webpack-plugin 配置
    config.plugin("html").tap((args) => {
      args[0].title = "我的应用";
      return args;
    });

    // 添加路径别名
    config.resolve.alias
      .set("@", path.resolve(__dirname, "src"))
      .set("components", path.resolve(__dirname, "src/components"));
  },

  configureWebpack: {
    // 直接合并的 webpack 配置
    performance: {
      hints: process.env.NODE_ENV === "production" ? "warning" : false,
    },
  },
};
```

## 环境变量

```bash
# .env                   # 所有环境
# .env.local             # 本地，不提交 git
# .env.development       # 开发环境
# .env.production        # 生产环境

VUE_APP_API_URL=https://api.example.com
VUE_APP_TITLE=My App
```

代码中：`process.env.VUE_APP_API_URL`

## 多页面配置

```javascript
module.exports = {
  pages: {
    index: {
      entry: "src/main.js",
      template: "public/index.html",
      filename: "index.html",
      title: "主页",
    },
    admin: {
      entry: "src/admin/main.js",
      template: "public/admin.html",
      filename: "admin.html",
      title: "管理后台",
    },
  },
};
```

## 插件开发

CLI 3 的插件系统很强大，自定义插件可以修改 webpack、生成文件、添加命令：

```javascript
// vue-cli-plugin-my-plugin/index.js
module.exports = (api, options) => {
  api.extendPackage({
    dependencies: { lodash: "^4.0.0" },
  });

  api.chainWebpack((config) => {
    // 修改 webpack 配置
  });

  api.registerCommand("my-command", async () => {
    console.log("执行自定义命令");
  });
};
```

## 小结

- CLI 3 GA 版可以放心用于生产
- `vue.config.js` 集中管理所有配置，比维护 webpack 文件简单
- CSS `prependData` 全局注入变量，省去每个组件手动 import
- 多页面配置非常简洁
