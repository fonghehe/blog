---
title: "ESLint v9 Flat Config：配置结构与迁移检查"
date: 2023-09-08 15:28:03
updated: 2026-10-24
version: "ESLint 9.x (historical migration)"
tags:
  - ESLint
readingTime: 2
wordCount: 545
description: "回顾 ESLint v9 的 Flat Config 配置数组、文件匹配、忽略规则与迁移验证，区分历史发布日期和后续修订。"
---

> 修订说明：保留原始归档日期与链接，本文于 2026-10-24 重写。ESLint v9 正式版发布于 2024-04-05，以下是后续整理的迁移说明，不代表 2023 年该版本已经正式发布。ESLint v9 已结束官方维护，新项目应参考官方版本支持表选择受维护版本。

Flat Config 的关键变化是用 JavaScript 模块导出配置数组。匹配同一文件的多个配置对象按顺序组合，后面的同名规则可以覆盖前面的值；`files` 决定对象作用于哪些文件。

## 一个配置数组

下面锁定历史上的 ESLint 9 与 `@eslint/js` 9，用于说明迁移结构。它是教学配置，不包含真实生产部署或性能验证的声明。

```javascript
// eslint.config.mjs — historical ESLint 9 example
import js from '@eslint/js'

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-unused-vars': 'warn' },
  },
]
```

`js.configs.recommended` 提供推荐规则，最后一个对象为 JavaScript 文件覆盖具体规则。只包含 `ignores` 的对象表达全局忽略规则。浏览器或 Node.js 全局变量、TypeScript 解析器、Vue 单文件组件解析器和框架插件需要按项目单独配置，不能把这份 JavaScript 示例当成所有项目的完整配置。

## 迁移时检查什么

1. 先固定 ESLint 与插件版本，确认插件支持 Flat Config 及对应 ESLint 主版本。
2. 将旧配置中的 `env`、`parserOptions`、`globals` 等逐项映射到新格式，避免只更改文件名。
3. 把忽略路径迁入配置。Flat Config 不会自动照搬旧 `.eslintignore` 的行为；路径匹配需要重新检查。
4. 对一个目标文件运行 `npx eslint --print-config src/example.js`，确认最终规则与语言选项。
5. 分别检查应通过、应报错和应被忽略的文件，再在项目中执行完整 lint。通过 lint 只能证明静态规则检查结果，不能证明业务功能正确。

## 版本与更新

本篇保留 v9 迁移背景；若使用当前版本，请以对应版本的官方迁移文档为准。这里不把配置示例标记为生产验证案例。

## 参考资料

- [ESLint v9.0.0 release — 2024-04-05](https://eslint.org/blog/2024/04/eslint-v9.0.0-released/)
- [ESLint v9 configuration migration guide](https://eslint.org/docs/v9.x/use/configure/migration-guide)
- [ESLint version support](https://eslint.org/version-support/)
