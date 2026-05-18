---
title: "Vue CLI 3 Plugin 开发：自动化项目初始化"
date: 2019-01-28 11:07:28
tags:
  - Vue
readingTime: 1
description: "团队项目多了，每次初始化都要手动配置 ESLint、Prettier、Git Hooks、CI 配置……做个 Vue CLI Plugin 一键搞定。"
---

团队项目多了，每次初始化都要手动配置 ESLint、Prettier、Git Hooks、CI 配置……做个 Vue CLI Plugin 一键搞定。

## Plugin 基本结构

```
vue-cli-plugin-company-preset/
├── generator/
│   ├── index.js         # 文件生成逻辑
│   └── template/        # 模板文件
│       ├── .eslintrc.js
│       ├── .prettierrc
│       └── _gitignore
├── prompts.js           # 交互式问题
├── index.js             # 服务扩展（开发/构建命令）
└── package.json
```

## prompts.js：问用户要什么

```javascript
// prompts.js
module.exports = [
  {
    type: "checkbox",
    name: "features",
    message: "选择需要的特性",
    choices: [
      { name: "ESLint + Prettier", value: "linting", checked: true },
      {
        name: "Git Hooks (husky + lint-staged)",
        value: "gitHooks",
        checked: true,
      },
      { name: "CI/CD 配置 (GitLab)", value: "ci" },
      { name: "单元测试 (Jest)", value: "testing" },
    ],
  },
  {
    type: "list",
    name: "cssPreprocessor",
    message: "CSS 预处理器",
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

  // 扩展 package.json
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

  // 安装完成后的提示
  api.onCreateComplete(() => {
    console.log("✅ 项目初始化完成！");
    console.log("运行 npm run lint 检查代码");
  });
};
```

## template 目录：EJS 模板

```javascript
// generator/template/.eslintrc.js
// 这是 EJS 模板，<%= %> 会被变量替换
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["plugin:vue/recommended", "@vue/standard"],
  rules: {
    // 项目统一规则
    "vue/component-name-in-template-casing": ["error", "PascalCase"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
  },
};
```

## index.js：扩展 vue-cli-service

```javascript
// index.js
module.exports = (api, projectOptions) => {
  // 扩展 serve 命令：添加 --open-devtools 选项
  api.configureWebpack((config) => {
    if (process.env.NODE_ENV === "development") {
      // 开发环境加一些调试配置
      config.devtool = "eval-source-map";
    }
  });

  // 注册自定义命令
  api.registerCommand(
    "clean",
    {
      description: "清理构建产物",
      usage: "vue-cli-service clean",
    },
    async (args) => {
      const fs = require("fs-extra");
      await fs.remove(api.resolve("dist"));
      console.log("✅ dist 目录已清理");
    },
  );
};
```

## 发布和使用

```bash
# 发布到私有 npm registry
npm publish --registry http://your-registry.com

# 项目中使用
vue add company-preset  # 会自动找 vue-cli-plugin-company-preset

# 或者直接 invoke
vue invoke company-preset
```

## 小结

- Vue CLI Plugin 分三部分：prompts（交互）、generator（生成文件）、index（服务扩展）
- `api.extendPackage` 合并 package.json，`api.render` 渲染模板文件
- 发布到私有 registry，全团队共享初始化配置
- 统一 ESLint + Git Hooks 是最基础的配置，减少不必要的代码风格争论
