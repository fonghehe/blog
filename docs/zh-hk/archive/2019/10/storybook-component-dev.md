---
title: "Storybook 組件開發環境搭建"
date: 2019-10-07 14:56:30
tags:
  - 測試
readingTime: 4
description: "在組件化開發成為主流的今天，如何高效地開發、測試和文檔化獨立組件是一個重要課題。Storybook 是一個開源的 UI 組件開發環境，它讓你可以在隔離環境中構建和展示組件，不依賴業務代碼。本文將從零搭建一個完整的 Storybook 開發環境。"
---

在組件化開發成為主流的今天，如何高效地開發、測試和文檔化獨立組件是一個重要課題。Storybook 是一個開源的 UI 組件開發環境，它讓你可以在隔離環境中構建和展示組件，不依賴業務代碼。本文將從零搭建一個完整的 Storybook 開發環境。

## 初始化項目

以 React 項目為例，使用 `npx` 初始化 Storybook：

```bash
npx -p @storybook/cli sb init
```

初始化完成後，會自動安裝依賴並創建 `.storybook` 配置目錄和 `stories` 示例目錄。項目結構如下：

```
├── .storybook
│   ├── addons.js
│   ├── config.js
│   └── webpack.config.js
├── stories
│   └── index.stories.js
└── package.json
```

## 編寫第一個 Story

一個 Story 就是組件在某種狀態下的展示。推薦使用 Component Story Format (CSF)，這是 Storybook 5.2 引入的新格式：

```jsx
import React from 'react';
import Button from '../components/Button';

export default {
  title: 'Components|Button',
  component: Button,
};

export const Default = () => <Button>點擊我</Button>;
Default.story = {
  name: '默認狀態',
};

export const Disabled = () => <Button disabled>不可點擊</Button>;

export const Loading = () => <Button loading>加載中...</Button>;
```

每個導出的函數都是一個獨立的 Story，在 Storybook 側邊欄中可以單獨查看和交互。

## 使用 Knobs 插件動態調整 Props

`@storybook/addon-knobs` 是最常用的插件之一，可以在 Storybook 面板中動態調整組件的 props：

```jsx
import React from 'react';
import { text, boolean, select, number } from '@storybook/addon-knobs';
import Button from '../components/Button';

export default {
  title: 'Components|Button',
  decorators: [withKnobs],
};

export const Playground = () => {
  const label = text('Label', '按鈕文字');
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

在 `.storybook/addons.js` 中註冊插件：

```js
import '@storybook/addon-knobs/register';
import '@storybook/addon-actions/register';
import '@storybook/addon-links/register';
```

## 使用 Actions 插件捕獲事件

Actions 插件可以在 Storybook 面板中查看組件觸發的事件回調，方便調試交互邏輯：

```jsx
import React from 'react';
import { action } from '@storybook/addon-actions';
import Button from '../components/Button';

export const WithOnClick = () => (
  <Button onClick={action('button-click')}>
    點擊查看事件
  </Button>
);

export const WithFormSubmit = () => (
  <form onSubmit={action('form-submit')}>
    <input onChange={action('input-change')} />
    <Button type="submit">提交</Button>
  </form>
);
```

## 配置自定義 Webpack

項目如果使用了 CSS Modules、TypeScript 等，需要擴展 Storybook 的 Webpack 配置：

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

  // 別名配置
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, '../src'),
  };

  config.resolve.extensions.push('.ts', '.tsx');

  return config;
};
```

## 添加 Docs 插件

Storybook 5.2 引入了 `@storybook/addon-docs`，用 MDX 格式編寫文檔更加直觀：

```mdx
import { Meta, Story, Preview, Props } from '@storybook/addon-docs/blocks';
import Button from '../components/Button';

<Meta title="Components|Button" component={Button} />

# Button 按鈕

按鈕用於觸發一個操作，支持多種尺寸和狀態。

## 基礎用法

<Preview>
  <Story name="Default">
    <Button>默認按鈕</Button>
  </Story>
  <Story name="Primary">
    <Button type="primary">主要按鈕</Button>
  </Story>
  <Story name="Danger">
    <Button type="danger">危險按鈕</Button>
  </Story>
</Preview>

## Props

<Props of={Button} />
```

## 使用 Decorators 全局包裝

Decorators 可以給每個 Story 添加統一的上下文，比如主題 Provider、Redux Store、Router 等：

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

也可以在單個 Story 級別添加 Decorator：

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

## 組織 Story 目錄結構

推薦按照組件的實際目錄結構來組織 Story 文件：

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Button.stories.tsx  ← Story 文件放在組件旁邊
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   ├── Modal.stories.tsx
│   │   └── index.ts
│   └── index.ts
```

在 `.storybook/config.js` 中配置文件匹配規則：

```js
const req = require.context('../src', true, /\.stories\.(js|tsx)$/);
```

## 與無障礙檢查集成

Storybook 非常適合作為組件庫的文檔站點。可以結合 `@storybook/addon-a11y` 做無障礙檢查：

```js
// .storybook/config.js
import { withA11y } from '@storybook/addon-a11y';

addDecorator(withA11y);
```

這樣每個 Story 面板都會顯示無障礙檢查結果，幫助確保組件的可訪問性。

## 構建靜態站點

Storybook 可以構建為靜態 HTML 站點，方便部署到任何靜態託管服務：

```bash
npm run build-storybook
```

構建產物在 `storybook-static` 目錄中，可以部署到 GitHub Pages、Netlify 或內部服務器。

```json
{
  "scripts": {
    "storybook": "start-storybook -p 9009",
    "build-storybook": "build-storybook -o docs",
    "deploy-storybook": "storybook-to-ghpages"
  }
}
```

## 小結

- Storybook 提供了隔離的組件開發環境，不依賴業務上下文
- CSF (Component Story Format) 是推薦的 Story 編寫格式
- Knobs 插件支持動態調整 props，方便交互式調試
- Actions 插件可以捕獲和展示組件的事件回調
- 自定義 Webpack 配置支持 CSS Modules、TypeScript 等
- Decorators 可以提供全局或局部的上下文包裝
- addon-docs 支持用 MDX 格式編寫組件文檔
- 可以構建為靜態站點，方便團隊共享和部署
