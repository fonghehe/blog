---
title: "VitePress 搭建技术文档站"
date: 2021-08-02 09:31:17
tags:
  - Vite
readingTime: 2
description: "给团队的组件库搭建文档站，对比了 VuePress 和 VitePress 后选择了后者。VitePress 基于 Vite + Vue 3，构建速度快了一个量级，而且配置更简洁。记录一下搭建过程和定制化配置。"
---

给团队的组件库搭建文档站，对比了 VuePress 和 VitePress 后选择了后者。VitePress 基于 Vite + Vue 3，构建速度快了一个量级，而且配置更简洁。记录一下搭建过程和定制化配置。

## 快速上手

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

package.json 中添加脚本：

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:serve": "vitepress serve docs"
  }
}
```

## 配置导航和侧边栏

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

## 在 Markdown 中嵌入 Vue 组件

VitePress 支持在 Markdown 中直接使用 Vue 组件，这是文档站最强大的功能：

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
|
------|------|------|--------|
| type | 按钮类型 | `'primary' \| 'default'` | `'default'` |
| size | 按钮大小 | `'small' \| 'medium' \| 'large'` | `'medium'` |
| disabled | 是否禁用 | `boolean` | `false` |
````

## 自定义首页

VitePress 支持 Hero 风格的首页：

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

## 部署

我们用的是 GitLab CI 自动部署到内网静态服务器：

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

## 小结

- VitePress 构建速度比 VuePress 快很多，开发体验更好
- 在 Markdown 中直接嵌入 Vue 组件是做组件文档的核心能力
- 配置简洁，上手门槛低，适合团队快速搭建
- 目前 VitePress 还在 0.x 阶段，API 可能有变动，但已足够稳定用于内部文档