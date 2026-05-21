---
title: "Node.js 指令碼開發實踐：自動化你的工作流"
date: 2019-02-19 14:43:49
tags:
  - TypeScript
readingTime: 2
description: "前端工程師寫 Node.js 指令碼，能解決很多重複勞動。整理一些實用的指令碼開發技巧。"
wordCount: 128
---

前端工程師寫 Node.js 指令碼，能解決很多重複勞動。整理一些實用的指令碼開發技巧。

## 基礎工具庫

```bash
npm i -g commander    # 命令列引數解析
npm i -g chalk        # 終端顏色
npm i -g inquirer     # 互動式問答
npm i -g ora          # 載入動畫
npm i -g fs-extra     # 增強的 fs 模組
```

## 批次重新命名檔案

```javascript
#!/usr/bin/env node
// rename-images.js：把 img001.jpg 批次改成 product-001.jpg

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

async function renameImages(dir, prefix) {
  const files = await fs.readdir(dir);
  const images = files.filter((f) => /\.(jpg|png|webp)$/i.test(f));

  console.log(chalk.blue(`找到 ${images.length} 張圖片`));

  for (let i = 0; i < images.length; i++) {
    const ext = path.extname(images[i]);
    const newName = `${prefix}-${String(i + 1).padStart(3, "0")}${ext}`;

    await fs.rename(path.join(dir, images[i]), path.join(dir, newName));
    console.log(chalk.green(`✅ ${images[i]} → ${newName}`));
  }
}

renameImages("./images", "product");
```

## 互動式腳手架

```javascript
#!/usr/bin/env node
// create-component.js：快速建立 Vue 元件

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
      message: "元件名稱 (PascalCase):",
      validate: (v) => /^[A-Z]/.test(v) || "請使用 PascalCase",
    },
    {
      type: "list",
      name: "dir",
      message: "放在哪個目錄:",
      choices: ["components", "views", "layouts"],
    },
    {
      type: "confirm",
      name: "hasProps",
      message: "新增 Props 模板?",
      default: false,
    },
  ]);

  const { name, dir, hasProps } = answers;
  const filePath = path.join("src", dir, `${name}.vue`);

  if (await fs.pathExists(filePath)) {
    console.log(chalk.red(`❌ ${filePath} 已存在`));
    return;
  }

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, TEMPLATE(name, hasProps));
  console.log(chalk.green(`✅ 建立成功: ${filePath}`));
}

main();
```

## 檢查依賴更新

```javascript
#!/usr/bin/env node
// check-updates.js：找出有新版本的依賴

const { execSync } = require("child_process");
const pkg = require("./package.json");

function getLatestVersion(name) {
  try {
    return execSync(`npm view ${name} version`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function checkUpdates() {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const outdated = [];

  for (const [name, version] of Object.entries(deps)) {
    const current = version.replace(/[\^~]/, "");
    const latest = getLatestVersion(name);

    if (latest && latest !== current) {
      outdated.push({ name, current, latest });
    }
  }

  if (outdated.length === 0) {
    console.log("✅ 所有依賴都是最新的");
    return;
  }

  console.log("\n有更新的依賴：");
  outdated.forEach(({ name, current, latest }) => {
    console.log(`  ${name}: ${current} → ${latest}`);
  });
}

checkUpdates();
```

## 實用的 npm scripts 組合

```json
{
  "scripts": {
    "new:component": "node scripts/create-component.js",
    "check:updates": "node scripts/check-updates.js",
    "rename:images": "node scripts/rename-images.js",

    "precommit": "lint-staged",
    "prepare": "husky install",

    "analyze": "ANALYZE=true npm run build",
    "size": "size-limit"
  }
}
```

## 小結

- `commander` 解析命令列引數，`inquirer` 做互動式問答
- `fs-extra` 是 `fs` 的增強版，支援 Promise 和額外方法（ensureDir、copy、move）
- 指令碼放 `scripts/` 目錄，通過 `npm scripts` 暴露給團隊
- 用 `#!/usr/bin/env node` 讓指令碼直接執行
