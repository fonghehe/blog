---
title: "Building a Technical Documentation Site with VitePress"
date: 2021-08-02 09:31:17
tags:
  - Vite
  - Engineering

readingTime: 2
description: "To build a documentation site for our team's component library, I compared VuePress and VitePress and chose the latter. VitePress is built on Vite plus Vue 3, builds an order of magnitude faster, and has cleaner configuration. Here's the setup process and custom configuration."
wordCount: 183
---

I built a documentation site for the team's component library. After comparing VuePress and VitePress, I chose the latter. VitePress is built on Vite + Vue 3, builds an order of magnitude faster, and has simpler configuration. Here are my notes on the setup process and customization.

## Quick Start

```bash
mkdir component-docs && cd component-docs
npm init -y
npm install vitepress vue --save-dev

# 目录结构
# docs/
# ├── .vitepress/
# │   └── config.ts
# ├── index.md
# ├── guide/
# │   └── getting-started.md
# └── components/
#     ├── button.md
#     └── table.md
```

Add the following scripts to package.json:

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:serve": "vitepress serve docs"
  }
}
```

## Configuring Navigation and Sidebar

```typescript
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Component Library',
  description: '团队组件库文档',

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '组件', link: '/components/button' },
      {
        text: '相关链接',
        items: [
          { text: 'GitLab', link: 'https://gitlab.company.com/xxx' },
          { text: 'Storybook', link: 'https://storybook.company.com' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '安装', link: '/guide/installation' }
          ]
        },
        {
          text: '进阶',
          items: [
            { text: '主题定制', link: '/guide/theming' },
            { text: '国际化', link: '/guide/i18n' }
          ]
        }
      ],
      '/components/': [
        {
          text: '基础组件',
          items: [
            { text: 'Button 按钮', link: '/components/button' },
            { text: 'Icon 图标', link: '/components/icon' }
          ]
        },
        {
          text: '数据展示',
          items: [
            { text: 'Table 表格', link: '/components/table' },
            { text: 'Tag 标签', link: '/components/tag' }
          ]
        }
      ]
    }
  }
})
```

## Embedding Vue Components in Markdown

VitePress lets you use Vue components directly in Markdown, which is the most powerful feature for a documentation site:

````markdown
# Button 按钮

基础用法：

<script setup>
import { MyButton } from '@company/components'
import '@company/components/dist/style.css'
</script>

<MyButton type="primary">主要按钮</MyButton>
<MyButton type="default">默认按钮</MyButton>

::: details 查看代码
```vue
<template>
  <MyButton type="primary">主要按钮</MyButton>
  <MyButton type="default">默认按钮</MyButton>
</template>
```
:::

## API

| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| type | 按钮类型 | `'primary' \| 'default'` | `'default'` |
| size | 按钮大小 | `'small' \| 'medium' \| 'large'` | `'medium'` |
| disabled | 是否禁用 | `boolean` | `false` |
````

## Custom Home Page

VitePress supports a Hero-style homepage:

```markdown
---
layout: home

hero:
  name: Component Library
  tagline: 基于 Vue 3 的企业级组件库
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 组件列表
      link: /components/button

features:
  - title: Vue 3 原生
    details: 基于 Composition API 构建，完整 TypeScript 支持
  - title: 按需引入
    details: 基于 ESM 的 Tree Shaking，未使用的组件不会打包
  - title: 主题定制
    details: CSS 变量驱动的主题系统，支持亮色和暗色模式
---
```

## Deployment

We use GitLab CI to deploy automatically to an internal static server:

```yaml
# .gitlab-ci.yml
pages:
  image: node:16
  script:
    - npm ci
    - npm run docs:build
    - mv docs/.vitepress/dist public
  artifacts:
    paths:
      - public
  only:
    - main
```

## Summary

- VitePress builds much faster than VuePress and offers a better dev experience
- Embedding Vue components directly in Markdown is the core capability for component docs
- The configuration is concise and the learning curve is low, making it ideal for teams to set up quickly
- VitePress is still in the 0.x stage and its API may change, but it's stable enough for internal docs