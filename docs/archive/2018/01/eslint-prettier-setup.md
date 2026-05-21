---
title: "ESLint + Prettier 工程化规范配置实践"
date: 2018-01-30 11:21:56
tags:
  - 工程化
readingTime: 2
description: "代码规范是团队协作的基础设施。每次 Code Review 花时间讨论缩进和引号风格是在浪费所有人的时间。ESLint + Prettier 的组合可以把这类问题自动化掉。"
wordCount: 462
---

代码规范是团队协作的基础设施。每次 Code Review 花时间讨论缩进和引号风格是在浪费所有人的时间。ESLint + Prettier 的组合可以把这类问题自动化掉。

## ESLint 和 Prettier 的分工

这两个工具经常被混淆，但它们解决的是不同的问题：

- **ESLint**：代码质量检查，找出潜在 bug 和不良实践（未使用的变量、`==` 而不是 `===`、循环引用等）
- **Prettier**：代码格式化，统一缩进、引号、行宽、逗号等纯风格问题

它们应该配合使用，而不是选一个。

## 基础安装

```bash
npm install --save-dev \
  eslint \
  prettier \
  eslint-config-prettier \     # 禁用与 Prettier 冲突的 ESLint 规则
  eslint-plugin-prettier \     # 把 Prettier 作为 ESLint 规则运行
  babel-eslint               # 让 ESLint 理解新语法（可选）
```

React 项目额外安装：

```bash
npm install --save-dev \
  eslint-plugin-react \
  eslint-plugin-react-hooks   # React Hooks 规则（React 16.7+）
```

Vue 项目额外安装：

```bash
npm install --save-dev eslint-plugin-vue
```

## ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  parser: "babel-eslint",

  env: {
    browser: true,
    es6: true,
    node: true,
  },

  extends: [
    "eslint:recommended", // ESLint 推荐规则
    "plugin:react/recommended", // React 推荐规则（React 项目）
    "prettier", // 禁用与 Prettier 冲突的规则（必须放最后）
    "prettier/react",
  ],

  plugins: ["prettier"],

  rules: {
    // Prettier 格式问题作为 ESLint error
    "prettier/prettier": "error",

    // 自定义规则
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "prefer-const": "error",
    "no-var": "error",

    // React 相关
    "react/prop-types": "warn",
    "react/display-name": "off",
  },

  settings: {
    react: {
      version: "detect", // 自动检测 React 版本
    },
  },
};
```

## Prettier 配置

```javascript
// .prettierrc.js
module.exports = {
  // 基础格式
  printWidth: 100, // 每行最大字符数
  tabWidth: 2, // 缩进宽度
  useTabs: false, // 用空格而非 Tab
  semi: false, // 不加分号（视团队习惯）
  singleQuote: true, // 用单引号

  // 对象和数组
  trailingComma: "es5", // ES5 合法的地方加尾逗号（对象、数组，不含函数参数）
  bracketSpacing: true, // { foo: bar } 加空格

  // JSX
  jsxSingleQuote: false, // JSX 属性用双引号
  jsxBracketSameLine: false, // JSX > 不和最后一个属性同行
};
```

关于是否加分号、单双引号，这些没有绝对对错，重要的是全团队一致。配置文件提交到 git，争论就此终止。

## 配置 .eslintignore 和 .prettierignore

```
# .eslintignore
node_modules/
dist/
build/
coverage/
*.min.js
public/

# .prettierignore
node_modules/
dist/
build/
package-lock.json
yarn.lock
```

## 集成到 npm scripts

```json
// package.json
{
  "scripts": {
    "lint": "eslint src --ext .js,.jsx,.vue",
    "lint:fix": "eslint src --ext .js,.jsx,.vue --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,css,vue,json}'"
  }
}
```

## Git Hooks：提交前自动检查

用 `husky` + `lint-staged` 在 git commit 前自动 lint 和格式化：

```bash
npm install --save-dev husky lint-staged
```

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/**/*.{js,jsx}": ["eslint --fix", "prettier --write", "git add"],
    "src/**/*.{css,scss}": ["prettier --write", "git add"]
  }
}
```

这个配置的效果：每次 `git commit` 时，只对本次修改的文件（而不是全量）运行 lint 和格式化，速度快，不影响未改动的文件。

## VSCode 编辑器集成

安装 ESLint 和 Prettier 扩展后，配置编辑器自动格式化：

```json
// .vscode/settings.json（提交到 git，统一团队编辑器配置）
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    { "language": "vue", "autoFix": true }
  ]
}
```

## 落地建议

在现有项目上推行代码规范，别一次性把所有规则都打开——会产生几百个 error，团队不会买账。建议分阶段：

1. **第一步**：只开 Prettier，统一格式，零 error
2. **第二步**：开启 `eslint:recommended`，修复已有问题
3. **第三步**：逐步添加团队约定的自定义规则

每一步都确保 CI 通过、存量代码合规，再进行下一步。

---

_1 月内容完结。2 月继续。_
