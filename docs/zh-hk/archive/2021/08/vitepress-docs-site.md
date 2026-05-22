---
title: "VitePress 搭建技術文檔站：落地路徑與實戰建議"
date: 2021-08-02 09:31:17
tags:
  - Vite
readingTime: 2
description: "給團隊的組件庫搭建文檔站，對比了 VuePress 和 VitePress 後選擇了後者。VitePress 基於 Vite + Vue 3，構建速度快了一個量級，而且設定更簡潔。記錄一下搭建過程和定製化設定。"
wordCount: 252
---

給團隊的組件庫搭建文檔站，對比了 VuePress 和 VitePress 後選擇了後者。VitePress 基於 Vite + Vue 3，構建速度快了一個量級，而且配置更簡潔。記錄一下搭建過程和定製化配置。

## 快速上手

```bash
mkdir component-docs && cd component-docs
npm init -y
npm install vitepress vue --save-dev

# 目錄結構
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

package.json 中添加腳本：

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:serve": "vitepress serve docs"
  }
}
```

## 設定導航和側邊欄

```typescript
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Component Library',
  description: '團隊組件庫文檔',

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '組件', link: '/components/button' },
      {
        text: '相關鏈接',
        items: [
          { text: 'GitLab', link: 'https://gitlab.company.com/xxx' },
          { text: 'Storybook', link: 'https://storybook.company.com' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入門',
          items: [
            { text: '快速開始', link: '/guide/getting-started' },
            { text: '安裝', link: '/guide/installation' }
          ]
        },
        {
          text: '進階',
          items: [
            { text: '主題定製', link: '/guide/theming' },
            { text: '國際化', link: '/guide/i18n' }
          ]
        }
      ],
      '/components/': [
        {
          text: '基礎組件',
          items: [
            { text: 'Button 按鈕', link: '/components/button' },
            { text: 'Icon 圖標', link: '/components/icon' }
          ]
        },
        {
          text: '數據展示',
          items: [
            { text: 'Table 表格', link: '/components/table' },
            { text: 'Tag 標籤', link: '/components/tag' }
          ]
        }
      ]
    }
  }
})
```

## 在 Markdown 中嵌入 Vue 組件

VitePress 支持在 Markdown 中直接使用 Vue 組件，這是文檔站最強大的功能：

````markdown
# Button 按鈕

基礎用法：

<script setup>
import { MyButton } from '@company/components'
import '@company/components/dist/style.css'
</script>

<MyButton type="primary">主要按鈕</MyButton>
<MyButton type="default">默認按鈕</MyButton>

::: details 查看代碼
```vue
<template>
  <MyButton type="primary">主要按鈕</MyButton>
  <MyButton type="default">默認按鈕</MyButton>
</template>
```
:::

## API

| 參數 | 説明 | 類型 | 默認值 |
|
------|------|------|--------|
| type | 按鈕類型 | `'primary' \| 'default'` | `'default'` |
| size | 按鈕大小 | `'small' \| 'medium' \| 'large'` | `'medium'` |
| disabled | 是否禁用 | `boolean` | `false` |
````

## 自定義首頁

VitePress 支援 Hero 風格的首頁：

```markdown
---
layout: home

hero:
  name: Component Library
  tagline: 基於 Vue 3 的企業級組件庫
  actions:
    - theme: brand
      text: 快速開始
      link: /guide/getting-started
    - theme: alt
      text: 組件列表
      link: /components/button

features:
  - title: Vue 3 原生
    details: 基於 Composition API 構建，完整 TypeScript 支持
  - title: 按需引入
    details: 基於 ESM 的 Tree Shaking，未使用的組件不會打包
  - title: 主題定製
    details: CSS 變量驅動的主題系統，支持亮色和暗色模式
---
```

## 部署

我們用的是 GitLab CI 自動部署到內網靜態服務器：

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

## 小結

- VitePress 構建速度比 VuePress 快很多，開發體驗更好
- 在 Markdown 中直接嵌入 Vue 組件是做組件文檔的核心能力
- 配置簡潔，上手門檻低，適合團隊快速搭建
- 目前 VitePress 還在 0.x 階段，API 可能有變動，但已足夠穩定用於內部文檔