---
title: "Vue CLI 3 プラグイン開発"
date: 2018-12-17 16:18:19
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3 リリース後、プロジェクトのスキャフォールディングが大幅に柔軟になった。CLI プラグインを使えば機能の追加や webpack 設定の変更が可能だ。最近チームの内部ツール用に CLI プラグインを書いたので、その過程をまとめる。"
wordCount: 239
---

Vue CLI 3 リリース後、プロジェクトのスキャフォールディングが大幅に柔軟になった。CLI プラグインを使えば機能の追加や webpack 設定の変更が可能だ。最近チームの内部ツール用に CLI プラグインを書いたので、その過程をまとめる。

## CLI プラグインの構造

```
vue-cli-plugin-xxx/
├── index.js         # Service プラグイン（webpack 変更・コマンド登録）
├── generator.js     # Generator（プロジェクトファイル変更・依存インストール）
├── prompts.js       # インタラクティブプロンプト（プロジェクト作成時の選択肢）
├── preset.json      # プリセット設定
└── package.json
```

## generator.js：プロジェクトファイルを変更する

```javascript
// generator.js
module.exports = (api, options, rootOptions) => {
  api.extendPackage({
    dependencies: {
      axios: "^0.19.0",
    },
    scripts: {
      generate: "node scripts/generate.js",
    },
  });

  api.render("./template", {
    baseUrl: options.baseUrl || "/api",
  });

  api.injectImports(api.entryFile, `import './plugins/axios'`);

  api.onCreateComplete(() => {
    console.log("axios プラグインのインストール完了！");
    console.log(".env ファイルで VUE_APP_API_URL を設定してください");
  });
};
```

## index.js：webpack 設定を変更する

```javascript
// index.js（Service プラグイン）
module.exports = (api, projectOptions) => {
  api.chainWebpack((config) => {
    config.resolve.alias.set("@utils", api.resolve("src/utils"));

    if (process.env.ANALYZE) {
      config
        .plugin("bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  });

  api.registerCommand(
    "generate",
    {
      description: "コード生成",
      usage: "vue-cli-service generate [type]",
    },
    async (args) => {
      const type = args._[0];
      if (type === "api") {
        await generateApi();
      } else if (type === "component") {
        await generateComponent(args);
      } else {
        console.error("不明な生成タイプ:", type);
      }
    },
  );
};
```

## まとめ

- `generator.js`：依存インストール・テンプレート描画・main.js 変更
- `index.js`：webpack 設定変更・CLI コマンド登録
- `prompts.js`：インタラクティブな作成オプション
- CLI プラグインはチーム内のベストプラクティスを標準化するのに最適
- プロジェクトごとの繰り返し設定作業を削減できる
