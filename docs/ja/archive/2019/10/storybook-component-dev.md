---
title: "Storybookコンポーネント開発環境の構築"
date: 2019-10-07 14:56:30
tags:
  - テスト
readingTime: 4
description: "在组件化开发成为主流的今天，如何高效地开发、测试和文档化独立组件是一个重要课题。Storybook 是一个开源的 UI 组件开发环境，它让你可以在隔离环境中构建和展示组件，不依赖业务代码。本文将从零搭建一个完整的 Storybook 开发环境。"
wordCount: 737
---

在组件化开发成为主流的今天，如何高效地开发、测试和文档化独立组件是一个重要课题。Storybook 是一个开源的 UI 组件开发环境，它让你可以在隔离环境中构建和展示组件，不依赖业务代码。本文将从零搭建一个完整的 Storybook 开发环境。

## プロジェクトの初期化

以 React 项目为例，使用 `npx` 初始化 Storybook：

```bash
npx -p @storybook/cli sb init
```

初始化完成后，会自动安装依赖并创建 `.storybook` 配置目录和 `stories` 示例目录。项目结构如下：

```
├── .storybook
│   ├── addons.js
│   ├── config.js
│   └── webpack.config.js
├── stories
│   └── index.stories.js
└── package.json
```

## 最初のStoryを書く

一个 Story 就是组件在某种状态下的展示。推荐使用 Component Story Format (CSF)，这是 Storybook 5.2 引入的新格式：

```jsx
import React from 'react';
import Button from '../components/Button';

export default {
  title: 'Components|Button',
  component: Button,
};

export const Default = () => <Button>点击我</Button>;
Default.story = {
  name: '默认状态',
};

export const Disabled = () => <Button disabled>不可点击</Button>;

export const Loading = () => <Button loading>加载中...</Button>;
```

每个导出的函数都是一个独立的 Story，在 Storybook 侧边栏中可以单独查看和交互。

## Knobsプラグインで動的にPropsを調整

`@storybook/addon-knobs` 是最常用的插件之一，可以在 Storybook 面板中动态调整组件的 props：

```jsx
import React from 'react';
import { text, boolean, select, number } from '@storybook/addon-knobs';
import Button from '../components/Button';

export default {
  title: 'Components|Button',
  decorators: [withKnobs],
};

export const Playground = () => {
  const label = text('Label', '按钮文字');
  const disabled = boolean('Disabled', false);
  const loading = boolean('Loading', false);
  const size = select('Size', ['small', 'medium', 'large'], 'medium');
  const type = select('Type', ['primary', 'default', 'danger'], 'default');

  return (
    <Button
      disabled={disabled}
      loading={loading}
      size={size}
      type={type}
    >
      {label}
    </Button>
  );
};
```

在 `.storybook/addons.js` 中注册插件：

```js
import '@storybook/addon-knobs/register';
import '@storybook/addon-actions/register';
import '@storybook/addon-links/register';
```

## Actionsプラグインでイベントをキャプチャ

Actions 插件可以在 Storybook 面板中查看组件触发的事件回调，方便调试交互逻辑：

```jsx
import React from 'react';
import { action } from '@storybook/addon-actions';
import Button from '../components/Button';

export const WithOnClick = () => (
  <Button onClick={action('button-click')}>
    点击查看事件
  </Button>
);

export const WithFormSubmit = () => (
  <form onSubmit={action('form-submit')}>
    <input onChange={action('input-change')} />
    <Button type="submit">提交</Button>
  </form>
);
```

## カスタムWebpackの設定

项目如果使用了 CSS Modules、TypeScript 等，需要扩展 Storybook 的 Webpack 配置：

```js
// .storybook/webpack.config.js
const path = require('path');

module.exports = ({ config }) => {
  // TypeScript 支持
  config.module.rules.push({
    test: /\.(ts|tsx)$/,
    use: [
      {
        loader: require.resolve('awesome-typescript-loader'),
      },
    ],
  });

  // CSS Modules 支持
  config.module.rules.push({
    test: /\.module\.css$/,
    use: [
      'style-loader',
      {
        loader: 'css-loader',
        options: {
          modules: {
            localIdentName: '[name]__[local]--[hash:base64:5]',
          },
        },
      },
    ],
    include: path.resolve(__dirname, '../src'),
  });

  // 普通 CSS
  config.module.rules.push({
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
    exclude: /\.module\.css$/,
  });

  // 别名配置
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, '../src'),
  };

  config.resolve.extensions.push('.ts', '.tsx');

  return config;
};
```

## Docsプラグインの追加

Storybook 5.2 引入了 `@storybook/addon-docs`，用 MDX 格式编写文档更加直观：

```mdx
import { Meta, Story, Preview, Props } from '@storybook/addon-docs/blocks';
import Button from '../components/Button';

<Meta title="Components|Button" component={Button} />

# Button 按钮

按钮用于触发一个操作，支持多种尺寸和状态。

## 基本的な使い方

<Preview>
  <Story name="Default">
    <Button>默认按钮</Button>
  </Story>
  <Story name="Primary">
    <Button type="primary">主要按钮</Button>
  </Story>
  <Story name="Danger">
    <Button type="danger">危险按钮</Button>
  </Story>
</Preview>

## Props

<Props of={Button} />
```

## Decoratorsを使ったグローバルラッピング

Decorators 可以给每个 Story 添加统一的上下文，比如主题 Provider、Redux Store、Router 等：

```js
{% raw %}
// .storybook/config.js
import { addDecorator, configure } from '@storybook/react';
import { ThemeProvider } from '../src/theme';
import { MemoryRouter } from 'react-router-dom';

// 全局 Decorator
addDecorator(story => (
  <ThemeProvider theme="light">
    <MemoryRouter>
      <div style={{ padding: '20px' }}>
        {story()}
      </div>
    </MemoryRouter>
  </ThemeProvider>
));

const req = require.context('../src', true, /\.stories\.(js|jsx|ts|tsx)$/);
function loadStories() {
  req.keys().forEach(filename => req(filename));
}

configure(loadStories, module);
{% endraw %}
```

也可以在单个 Story 级别添加 Decorator：

```jsx
{% raw %}
export default {
  title: 'Components|Modal',
  decorators: [
    Story => (
      <div style={{ width: '600px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};
{% endraw %}
```

## Storyのディレクトリ構造の整理

推荐按照组件的实际目录结构来组织 Story 文件：

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Button.stories.tsx  ← Story 文件放在组件旁边
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   ├── Modal.stories.tsx
│   │   └── index.ts
│   └── index.ts
```

在 `.storybook/config.js` 中配置文件匹配规则：

```js
const req = require.context('../src', true, /\.stories\.(js|tsx)$/);
```

## アクセシビリティチェックとの統合

Storybook 非常适合作为组件库的文档站点。可以结合 `@storybook/addon-a11y` 做无障碍检查：

```js
// .storybook/config.js
import { withA11y } from '@storybook/addon-a11y';

addDecorator(withA11y);
```

这样每个 Story 面板都会显示无障碍检查结果，帮助确保组件的可访问性。

## 静的サイトの構築

Storybook 可以构建为静态 HTML 站点，方便部署到任何静态托管服务：

```bash
npm run build-storybook
```

构建产物在 `storybook-static` 目录中，可以部署到 GitHub Pages、Netlify 或内部服务器。

```json
{
  "scripts": {
    "storybook": "start-storybook -p 9009",
    "build-storybook": "build-storybook -o docs",
    "deploy-storybook": "storybook-to-ghpages"
  }
}
```

## まとめ

- Storybook 提供了隔离的组件开发环境，不依赖业务上下文
- CSF (Component Story Format) 是推荐的 Story 编写格式
- Knobs 插件支持动态调整 props，方便交互式调试
- Actions 插件可以捕获和展示组件的事件回调
- 自定义 Webpack 配置支持 CSS Modules、TypeScript 等
- Decorators 可以提供全局或局部的上下文包装
- addon-docs 支持用 MDX 格式编写组件文档
- 可以构建为静态站点，方便团队共享和部署
