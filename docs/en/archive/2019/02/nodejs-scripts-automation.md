---
title: "Node.js Script Development in Practice: Automating Your Workflow"
date: 2019-02-19 14:43:49
tags:
  - TypeScript
readingTime: 1
description: "Frontend engineers writing Node.js scripts can eliminate a lot of repetitive work. Here are some practical scripting tips."
---

Frontend engineers writing Node.js scripts can eliminate a lot of repetitive work. Here are some practical scripting tips.

## Essential Utility Libraries

```bash
npm i -g commander    # command-line argument parsing
npm i -g chalk        # terminal colors
npm i -g inquirer     # interactive prompts
npm i -g ora          # loading spinners
npm i -g fs-extra     # enhanced fs module
```

## Batch File Renaming

```javascript
#!/usr/bin/env node
// rename-images.js: batch rename img001.jpg to product-001.jpg

const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

async function renameImages(dir, prefix) {
  const files = await fs.readdir(dir);
  const images = files.filter((f) => /\.(jpg|png|webp)$/i.test(f));

  console.log(chalk.blue(`Found ${images.length} images`));

  for (let i = 0; i < images.length; i++) {
    const ext = path.extname(images[i]);
    const newName = `${prefix}-${String(i + 1).padStart(3, "0")}${ext}`;

    await fs.rename(path.join(dir, images[i]), path.join(dir, newName));
    console.log(chalk.green(`✅ ${images[i]} → ${newName}`));
  }
}

renameImages("./images", "product");
```

## Interactive Scaffolding

```javascript
#!/usr/bin/env node
// create-component.js: quickly create a Vue component

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
      message: "Component name (PascalCase):",
      validate: (v) => /^[A-Z]/.test(v) || "Please use PascalCase",
    },
    {
      type: "list",
      name: "dir",
      message: "Which directory to place it in:",
```
