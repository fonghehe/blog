---
title: "Vue CLI 3 Beta 初体验"
date: 2018-06-07 10:24:17
tags:
  - Vue
readingTime: 2
description: "Vue CLI 3 刚出 Beta，和之前的 CLI 2 差别很大，试用了一下记录一下感受。"
wordCount: 346
---

Vue CLI 3 刚出 Beta，和之前的 CLI 2 差别很大，试用了一下记录一下感受。

## 最大变化：零配置

CLI 2 需要手动维护 webpack.config.js，文件又长又难懂。CLI 3 把 webpack 配置完全封装起来，开箱即用：

```bash
npm install -g @vue/cli
vue create my-app
cd my-app
npm run serve
```

就这样，完全不需要动 webpack 配置。

## 配置方式：vue.config.js

如果需要自定义，在项目根目录创建 `vue.config.js`：

```javascript
// vue.config.js
module.exports = {
  // 公共路径
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 开发服务器代理
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  // webpack 配置合并
  configureWebpack: {
    plugins: [new MyPlugin()],
  },

  // webpack 链式修改
  chainWebpack: (config) => {
    config.plugin("html").tap((args) => {
      args[0].title = "我的应用";
      return args;
    });
  },
};
```

## 插件系统

CLI 3 的一大亮点是插件化。添加功能不再是手动改配置，而是安装插件：

```bash
vue add router      # 添加 Vue Router
vue add vuex        # 添加 Vuex
vue add element-ui  # 添加 Element UI
vue add pwa         # 添加 PWA 支持
vue add typescript  # 添加 TypeScript
```

插件会自动修改项目结构和配置，不需要手动改。

## 环境变量

```bash
# .env.production
VUE_APP_API_URL=https://api.example.com
VUE_APP_VERSION=1.0.0
```

在代码里用 `process.env.VUE_APP_*` 访问（只有 `VUE_APP_` 前缀的才会暴露给客户端）。

## GUI 界面

CLI 3 还有一个 Web 界面（!）：

```bash
vue ui
```

打开浏览器，可以在界面里管理插件、运行脚本、查看构建分析。对不熟悉命令行的人很友好。

## 和 CLI 2 的迁移

旧项目如果想用 CLI 3，暂时没有自动迁移工具，建议新项目用 CLI 3。旧项目可以继续用 CLI 2 维护，等时机成熟再迁移。

## 小结

- 零配置，webpack 完全封装，不需要手动维护
- `vue.config.js` 提供灵活的配置入口
- `vue add` 插件命令一键集成功能
- GUI 界面是亮点，降低了入门门槛
