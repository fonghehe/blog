---
title: "VitePress で技術ドキュメントサイトを構築する"
date: 2021-08-02 09:31:17
tags:
  - Vite
  - エンジニアリング

readingTime: 2
description: "チームのコンポーネントライブラリ向けにドキュメントサイトを構築するにあたり、VuePress と VitePress を比較して後者を選んだ。VitePress は Vite + Vue 3 ベースでビルド速度が一桁速く、設定も簡潔だ。構築手順とカスタマイズ設定を記録する。"
wordCount: 422
---

チームのコンポーネントライブラリ向けにドキュメントサイトを構築するにあたり、VuePress と VitePress を比較して後者を選んだ。VitePress は Vite + Vue 3 ベースで、ビルド速度が一桁速く、設定も簡潔だ。構築手順とカスタマイズ設定を記録する。

## クイックスタート

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

package.json にスクリプトを追加する：

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:serve": "vitepress serve docs"
  }
}
```

## ナビゲーションとサイドバーの設定

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

## Markdown への Vue コンポーネントの埋め込み

VitePress は Markdown 内で Vue コンポーネントを直接使える。これがドキュメントサイトとして最も強力な機能だ：

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

## カスタムホームページ

VitePress は Hero スタイルのホームページにも対応している：

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

## デプロイ

私たちは GitLab CI で内網の静的サーバーへ自動デプロイしている：

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

## まとめ

- VitePress のビルド速度は VuePress より大幅に速く、開発体験も優れている
- Markdown 内に Vue コンポーネントを直接埋め込めることは、コンポーネントドキュメントの中核となる機能だ
- 設定が簡潔で学習コストが低く、チームでの迅速な構築に適している
- 現在 VitePress はまだ 0.x 段階であり API が変わる可能性はあるが、内部ドキュメントには十分安定して使える