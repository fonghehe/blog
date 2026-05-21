---
title: "Node.jsスクリプト開発実践：ワークフローを自動化する"
date: 2019-02-19 14:43:49
tags:
  - TypeScript
readingTime: 1
description: "フロントエンドエンジニアがNode.jsスクリプトを書くと、多くの繰り返し作業を解消できる。実用的なスクリプト開発のコツをまとめる。"
wordCount: 101
---

フロントエンドエンジニアがNode.jsスクリプトを書くと、多くの繰り返し作業を解消できる。実用的なスクリプト開発のコツをまとめる。

## 基本ユーティリティライブラリ

```bash
npm i -g commander    # コマンドライン引数解析
npm i -g chalk        # ターミナルカラー
npm i -g inquirer     # インタラクティブプロンプト
npm i -g ora          # ローディングスピナー
npm i -g fs-extra     # 強化されたfsモジュール
```

## ファイルの一括リネーム

```javascript
#!/usr/bin/env node
// rename-images.js：img001.jpgをproduct-001.jpgに一括リネーム

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

async function renameImages(dir, prefix) {
  const files = await fs.readdir(dir);
  const images = files.filter((f) => /\.(jpg|png|webp)$/i.test(f));

  console.log(chalk.blue(`${images.length}枚の画像が見つかりました`));

  for (let i = 0; i < images.length; i++) {
    const ext = path.extname(images[i]);
    const newName = `${prefix}-${String(i + 1).padStart(3, "0")}${ext}`;

    await fs.rename(path.join(dir, images[i]), path.join(dir, newName));
    console.log(chalk.green(`✅ ${images[i]} → ${newName}`));
  }
}

renameImages("./images", "product");
```

## インタラクティブスキャフォールディング

```javascript
#!/usr/bin/env node
// create-component.js：Vueコンポーネントを素早く作成

const inquirer = require("inquirer");
const fs = require("fs-extra");
const path = require("path");

const TEMPLATE = (name, hasProps) => `<template>
  <div class="${name.toLowerCase()}">
    <slot />
  </div>
</template>

<script>
export default {
  name: '${name}',
  ${
    hasProps
      ? `props: {
    value: {
      type: String,
      default: ''
    }
  },`
      : ""
  }
  data() {
    return {}
  }
}
</script>

<style lang="scss" scoped>
.${name.toLowerCase()} {
}
</style>
`;

async function main() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "コンポーネント名（PascalCase）：",
      validate: (v) => /^[A-Z]/.test(v) || "PascalCaseを使ってください",
    },
    {
      type: "list",
      name: "dir",
      message: "どのディレクトリに置きますか：",
```
