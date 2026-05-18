---
title: "Vue CLI 3 外掛開發"
date: 2018-12-17 16:18:19
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3 釋出後，專案腳手架的靈活性大大提高。CLI 外掛可以給專案新增功能、修改 webpack 配置。最近給團隊內部工具寫了一個 CLI 外掛，記錄一下過程。"
---

Vue CLI 3 釋出後，專案腳手架的靈活性大大提高。CLI 外掛可以給專案新增功能、修改 webpack 配置。最近給團隊內部工具寫了一個 CLI 外掛，記錄一下過程。

## CLI 外掛的結構

```
vue-cli-plugin-xxx/
├── index.js         # 外掛的 Service 外掛（修改 webpack、註冊命令）
├── generator.js     # Generator（修改專案檔案，安裝依賴）
├── prompts.js       # 互動式詢問（建立專案時的選項）
├── preset.json      # 預設配置
└── package.json
```

## generator.js：修改專案檔案

```javascript
// generator.js
module.exports = (api, options, rootOptions) => {
  // 安裝依賴
  api.extendPackage({
    dependencies: {
      axios: "^0.19.0",
    },
    scripts: {
      generate: "node scripts/generate.js",
    },
  });

  // 渲染模板檔案到專案目錄
  api.render("./template", {
    // 傳給模板的變數
    baseUrl: options.baseUrl || "/api",
  });

  // 在 main.js 裡新增匯入
  api.injectImports(api.entryFile, `import './plugins/axios'`);

  // 操作完成後的提示
  api.onCreateComplete(() => {
    console.log("axios 外掛安裝完成！");
    console.log("請在 .env 檔案中配置 VUE_APP_API_URL");
  });
};
```

## template 目錄（EJS 模板）

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
// index.js（Service 外掛）
module.exports = (api, projectOptions) => {
  // 修改 webpack 配置
  api.chainWebpack((config) => {
    // 新增一個別名
    config.resolve.alias.set("@utils", api.resolve("src/utils"));

    // 在生產構建中分析 bundle
    if (process.env.ANALYZE) {
      config
        .plugin("bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  });

  // 註冊自定義命令
  api.registerCommand(
    "generate",
    {
      description: "程式碼生成",
      usage: "vue-cli-service generate [type]",
    },
    async (args) => {
      const type = args._[0];
      if (type === "api") {
        await generateApi();
      } else if (type === "component") {
        await generateComponent(args);
      } else {
        console.error("未知生成型別:", type);
      }
    },
  );
};
```

## prompts.js：建立時的選項

```javascript
// prompts.js
module.exports = [
  {
    type: "input",
    name: "baseUrl",
    message: "API 基礎路徑",
    default: "/api",
  },
  {
    type: "confirm",
    name: "addMock",
    message: "是否新增 Mock 資料支援？",
    default: true,
  },
];
```

## 本地測試外掛

```bash
# 在外掛目錄
npm link

# 在測試專案目錄
npm link vue-cli-plugin-xxx

# 呼叫外掛的 generator
vue invoke vue-cli-plugin-xxx

# 或者在建立專案時使用
vue create my-project --preset ./preset.json
```

## 使用團隊的 CLI 外掛

```bash
# 安裝到現有專案
vue add my-company-xxx

# package.json 裡會多一條
{
  "devDependencies": {
    "vue-cli-plugin-my-company-xxx": "^1.0.0"
  }
}
```

## 小結

- `generator.js`：安裝依賴、渲染模板、修改 main.js
- `index.js`：修改 webpack 配置、註冊 CLI 命令
- `prompts.js`：互動式建立選項
- CLI 外掛適合把團隊內部的最佳實踐標準化
- 減少每個專案的重複配置工作
