---
title: "Vue CLI 3 插件开发"
date: 2018-12-17 16:18:19
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3 发布后，项目脚手架的灵活性大大提高。CLI 插件可以给项目添加功能、修改 webpack 配置。最近给团队内部工具写了一个 CLI 插件，记录一下过程。"
---

Vue CLI 3 发布后，项目脚手架的灵活性大大提高。CLI 插件可以给项目添加功能、修改 webpack 配置。最近给团队内部工具写了一个 CLI 插件，记录一下过程。

## CLI 插件的结构

```
vue-cli-plugin-xxx/
├── index.js         # 插件的 Service 插件（修改 webpack、注册命令）
├── generator.js     # Generator（修改项目文件，安装依赖）
├── prompts.js       # 交互式询问（创建项目时的选项）
├── preset.json      # 预设配置
└── package.json
```

## generator.js：修改项目文件

```javascript
// generator.js
module.exports = (api, options, rootOptions) => {
  // 安装依赖
  api.extendPackage({
    dependencies: {
      axios: "^0.19.0",
    },
    scripts: {
      generate: "node scripts/generate.js",
    },
  });

  // 渲染模板文件到项目目录
  api.render("./template", {
    // 传给模板的变量
    baseUrl: options.baseUrl || "/api",
  });

  // 在 main.js 里添加导入
  api.injectImports(api.entryFile, `import './plugins/axios'`);

  // 操作完成后的提示
  api.onCreateComplete(() => {
    console.log("axios 插件安装完成！");
    console.log("请在 .env 文件中配置 VUE_APP_API_URL");
  });
};
```

## template 目录（EJS 模板）

```javascript
// template/src/plugins/axios.js
import axios from "axios";
import Vue from "vue";

const service = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "<%= baseUrl %>",
  timeout: 15000,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

Vue.prototype.$http = service;
export default service;
```

## index.js：修改 webpack 配置

```javascript
// index.js（Service 插件）
module.exports = (api, projectOptions) => {
  // 修改 webpack 配置
  api.chainWebpack((config) => {
    // 添加一个别名
    config.resolve.alias.set("@utils", api.resolve("src/utils"));

    // 在生产构建中分析 bundle
    if (process.env.ANALYZE) {
      config
        .plugin("bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  });

  // 注册自定义命令
  api.registerCommand(
    "generate",
    {
      description: "代码生成",
      usage: "vue-cli-service generate [type]",
    },
    async (args) => {
      const type = args._[0];
      if (type === "api") {
        await generateApi();
      } else if (type === "component") {
        await generateComponent(args);
      } else {
        console.error("未知生成类型:", type);
      }
    },
  );
};
```

## prompts.js：创建时的选项

```javascript
// prompts.js
module.exports = [
  {
    type: "input",
    name: "baseUrl",
    message: "API 基础路径",
    default: "/api",
  },
  {
    type: "confirm",
    name: "addMock",
    message: "是否添加 Mock 数据支持？",
    default: true,
  },
];
```

## 本地测试插件

```bash
# 在插件目录
npm link

# 在测试项目目录
npm link vue-cli-plugin-xxx

# 调用插件的 generator
vue invoke vue-cli-plugin-xxx

# 或者在创建项目时使用
vue create my-project --preset ./preset.json
```

## 使用团队的 CLI 插件

```bash
# 安装到现有项目
vue add my-company-xxx

# package.json 里会多一条
{
  "devDependencies": {
    "vue-cli-plugin-my-company-xxx": "^1.0.0"
  }
}
```

## 小结

- `generator.js`：安装依赖、渲染模板、修改 main.js
- `index.js`：修改 webpack 配置、注册 CLI 命令
- `prompts.js`：交互式创建选项
- CLI 插件适合把团队内部的最佳实践标准化
- 减少每个项目的重复配置工作
