---
title: "Node.js 脚本开发实践：自动化你的工作流"
date: 2019-02-19 14:43:49
tags:
  - TypeScript
---

前端工程师写 Node.js 脚本，能解决很多重复劳动。整理一些实用的脚本开发技巧。

## 基础工具库

```bash
npm i -g commander    # 命令行参数解析
npm i -g chalk        # 终端颜色
npm i -g inquirer     # 交互式问答
npm i -g ora          # 加载动画
npm i -g fs-extra     # 增强的 fs 模块
```

## 批量重命名文件

```javascript
#!/usr/bin/env node
// rename-images.js：把 img001.jpg 批量改成 product-001.jpg

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

async function renameImages(dir, prefix) {
  const files = await fs.readdir(dir);
  const images = files.filter((f) => /\.(jpg|png|webp)$/i.test(f));

  console.log(chalk.blue(`找到 ${images.length} 张图片`));

  for (let i = 0; i < images.length; i++) {
    const ext = path.extname(images[i]);
    const newName = `${prefix}-${String(i + 1).padStart(3, "0")}${ext}`;

    await fs.rename(path.join(dir, images[i]), path.join(dir, newName));
    console.log(chalk.green(`✅ ${images[i]} → ${newName}`));
  }
}

renameImages("./images", "product");
```

## 交互式脚手架

```javascript
#!/usr/bin/env node
// create-component.js：快速创建 Vue 组件

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
      message: "组件名称 (PascalCase):",
      validate: (v) => /^[A-Z]/.test(v) || "请使用 PascalCase",
    },
    {
      type: "list",
      name: "dir",
      message: "放在哪个目录:",
      choices: ["components", "views", "layouts"],
    },
    {
      type: "confirm",
      name: "hasProps",
      message: "添加 Props 模板?",
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
  console.log(chalk.green(`✅ 创建成功: ${filePath}`));
}

main();
```

## 检查依赖更新

```javascript
#!/usr/bin/env node
// check-updates.js：找出有新版本的依赖

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
    console.log("✅ 所有依赖都是最新的");
    return;
  }

  console.log("\n有更新的依赖：");
  outdated.forEach(({ name, current, latest }) => {
    console.log(`  ${name}: ${current} → ${latest}`);
  });
}

checkUpdates();
```

## 实用的 npm scripts 组合

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

## 小结

- `commander` 解析命令行参数，`inquirer` 做交互式问答
- `fs-extra` 是 `fs` 的增强版，支持 Promise 和额外方法（ensureDir、copy、move）
- 脚本放 `scripts/` 目录，通过 `npm scripts` 暴露给团队
- 用 `#!/usr/bin/env node` 让脚本直接执行
