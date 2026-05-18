---
title: "Vue CLI 3 Plugin 開發：自動化項目初始化"
date: 2019-01-28 11:07:28
tags:
  - Vue
readingTime: 1
description: "團隊項目多了，每次初始化都要手動配置 ESLint、Prettier、Git Hooks、CI 配置……做個 Vue CLI Plugin 一鍵搞定。"
---

團隊項目多了，每次初始化都要手動配置 ESLint、Prettier、Git Hooks、CI 配置……做個 Vue CLI Plugin 一鍵搞定。

## Plugin 基本結構

```
vue-cli-plugin-company-preset/
├── generator/
│   ├── index.js         # 文件生成邏輯
│   └── template/        # 模板文件
│       ├── .eslintrc.js
│       ├── .prettierrc
│       └── _gitignore
├── prompts.js           # 交互式問題
├── index.js             # 服務擴展（開發/構建命令）
└── package.json
```

## prompts.js：問用户要什麼

```javascript
// prompts.js
module.exports = [
  {
    type: "checkbox",
    name: "features",
    message: "選擇需要的特性",
    choices: [
      { name: "ESLint + Prettier", value: "linting", checked: true },
      {
        name: "Git Hooks (husky + lint-staged)",
        value: "gitHooks",
        checked: true,
      },
      { name: "CI/CD 配置 (GitLab)", value: "ci" },
      { name: "單元測試 (Jest)", value: "testing" },
    ],
  },
  {
    type: "list",
    name: "cssPreprocessor",
    message: "CSS 預處理器",
    choices: ["scss", "less", "none"],
    default: "scss",
  },
];
```

## generator/index.js：生成文件

```javascript
// generator/index.js
module.exports = (api, options, rootOptions) => {
  const { features, cssPreprocessor } = options;

  // 擴展 package.json
  api.extendPackage({
    scripts: {
      lint: "eslint --ext .js,.vue src",
      "lint:fix": "eslint --ext .js,.vue src --fix",
    },
    devDependencies: {
      eslint: "^6.0.0",
      "eslint-plugin-vue": "^6.0.0",
      "@vue/eslint-config-standard": "^4.0.0",
    },
  });

  if (features.includes("gitHooks")) {
    api.extendPackage({
      devDependencies: {
        husky: "^3.0.0",
        "lint-staged": "^9.0.0",
      },
      husky: {
        hooks: {
          "pre-commit": "lint-staged",
        },
      },
      "lint-staged": {
        "*.{js,vue}": ["eslint --fix", "git add"],
      },
    });
  }

  // 渲染模板文件
  api.render("./template", {
    cssPreprocessor,
    hasCI: features.includes("ci"),
  });

  // 安裝完成後的提示
  api.onCreateComplete(() => {
    console.log("✅ 項目初始化完成！");
    console.log("運行 npm run lint 檢查代碼");
  });
};
```

## template 目錄：EJS 模板

```javascript
// generator/template/.eslintrc.js
// 這是 EJS 模板，<%= %> 會被變量替換
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["plugin:vue/recommended", "@vue/standard"],
  rules: {
    // 項目統一規則
    "vue/component-name-in-template-casing": ["error", "PascalCase"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
  },
};
```

## index.js：擴展 vue-cli-service

```javascript
// index.js
module.exports = (api, projectOptions) => {
  // 擴展 serve 命令：添加 --open-devtools 選項
  api.configureWebpack((config) => {
    if (process.env.NODE_ENV === "development") {
      // 開發環境加一些調試配置
      config.devtool = "eval-source-map";
    }
  });

  // 註冊自定義命令
  api.registerCommand(
    "clean",
    {
      description: "清理構建產物",
      usage: "vue-cli-service clean",
    },
    async (args) => {
      const fs = require("fs-extra");
      await fs.remove(api.resolve("dist"));
      console.log("✅ dist 目錄已清理");
    },
  );
};
```

## 發佈和使用

```bash
# 發佈到私有 npm registry
npm publish --registry http://your-registry.com

# 項目中使用
vue add company-preset  # 會自動找 vue-cli-plugin-company-preset

# 或者直接 invoke
vue invoke company-preset
```

## 小結

- Vue CLI Plugin 分三部分：prompts（交互）、generator（生成文件）、index（服務擴展）
- `api.extendPackage` 合併 package.json，`api.render` 渲染模板文件
- 發佈到私有 registry，全團隊共享初始化配置
- 統一 ESLint + Git Hooks 是最基礎的配置，減少不必要的代碼風格爭論
