---
title: "Vue CLI 3 プラグイン開発：プロジェクト初期化の自動化"
date: 2019-01-28 11:07:28
tags:
  - Vue
readingTime: 1
description: "チームのプロジェクトが増えると、毎回ESLint、Prettier、Git Hooks、CI設定を手動で行うのが煩わしい。Vue CLI Pluginを作れば、ワンクリックで全て完了できる。"
---

チームのプロジェクトが増えると、毎回ESLint、Prettier、Git Hooks、CI設定を手動で行うのが煩わしい。Vue CLI Pluginを作れば、ワンクリックで全て完了できる。

## プラグインの基本構造

```
vue-cli-plugin-company-preset/
├── generator/
│   ├── index.js         # ファイル生成ロジック
│   └── template/        # テンプレートファイル
│       ├── .eslintrc.js
│       ├── .prettierrc
│       └── _gitignore
├── prompts.js           # インタラクティブな質問
├── index.js             # サービス拡張（開発/ビルドコマンド）
└── package.json
```

## prompts.js：ユーザーへの質問

```javascript
// prompts.js
module.exports = [
  {
    type: "checkbox",
    name: "features",
    message: "必要な機能を選択",
    choices: [
      { name: "ESLint + Prettier", value: "linting", checked: true },
      {
        name: "Git Hooks (husky + lint-staged)",
        value: "gitHooks",
        checked: true,
      },
      { name: "CI/CD 設定 (GitLab)", value: "ci" },
      { name: "ユニットテスト (Jest)", value: "testing" },
    ],
  },
  {
    type: "list",
    name: "cssPreprocessor",
    message: "CSSプリプロセッサ",
    choices: ["scss", "less", "none"],
    default: "scss",
  },
];
```

## generator/index.js：ファイルの生成

```javascript
// generator/index.js
module.exports = (api, options, rootOptions) => {
  const { features, cssPreprocessor } = options;

  // package.jsonを拡張
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

  // テンプレートファイルをレンダリング
  api.render("./template", {
    cssPreprocessor,
    hasCI: features.includes("ci"),
  });

  // インストール完了後のメッセージ
  api.onCreateComplete(() => {
    console.log("✅ プロジェクト初期化完了！");
    console.log("npm run lint でコードをチェック");
  });
};
```

## templateディレクトリ：EJSテンプレート

```javascript
// generator/template/.eslintrc.js
// EJSテンプレート；<%= %>は変数値に置換される
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["plugin:vue/recommended", "@vue/standard"],
  rules: {
    // チーム統一ルール
    "vue/component-name-in-template-casing": ["error", "PascalCase"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
```
