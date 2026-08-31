---
title: "Setting Up a Storybook Component Development Environment"
date: 2019-10-07 14:56:30
tags:
  - Testing
readingTime: 4
description: "Now that component-based development is mainstream, efficiently developing, testing, and documenting standalone components has become an important challenge. Storybook is an open-source UI component development environment that lets you build and showcase components in isolation, free from business code. This article walks through setting up a complete Storybook development environment from scratch."
wordCount: 468
---

Now that component-based development is mainstream, efficiently developing, testing, and documenting standalone components has become an important challenge. Storybook is an open-source UI component development environment that lets you build and showcase components in isolation, free from business code. This article walks through setting up a complete Storybook development environment from scratch.

## Project Initialization

Taking a React project as an example, initialize Storybook with `npx`:

```bash
npx -p @storybook/cli sb init
```

Once initialization finishes, the dependencies are installed automatically and a `.storybook` config directory plus a `stories` example directory are created. The project structure looks like this:

```
├── .storybook
│   ├── addons.js
│   ├── config.js
│   └── webpack.config.js
├── stories
│   └── index.stories.js
└── package.json
```

## Writing Your First Story

A Story is a rendering of a component in a particular state. The recommended format is Component Story Format (CSF), a new format introduced in Storybook 5.2:

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

Each exported function is an independent Story that you can view and interact with individually in the Storybook sidebar.

## Using the Knobs Plugin for Dynamic Props

`@storybook/addon-knobs` is one of the most commonly used addons—it lets you adjust a component's props dynamically from the Storybook panel:

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

Register the addons in `.storybook/addons.js`:

```js
import '@storybook/addon-knobs/register';
import '@storybook/addon-actions/register';
import '@storybook/addon-links/register';
```

## Using the Actions Plugin to Capture Events

The Actions addon lets you see the event callbacks a component fires right in the Storybook panel, which makes debugging interactions easier:

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

## Configuring Custom Webpack

If your project uses CSS Modules, TypeScript, and the like, you'll need to extend Storybook's Webpack configuration:

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

## Adding the Docs Plugin

Storybook 5.2 introduced `@storybook/addon-docs`, which makes writing documentation more intuitive with the MDX format:

```mdx
import { Meta, Story, Preview, Props } from '@storybook/addon-docs/blocks';
import Button from '../components/Button';

<Meta title="Components|Button" component={Button} />

# Button 按钮

按钮用于触发一个操作，支持多种尺寸和状态。

## Basic Usage

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

## Global Wrapping with Decorators

Decorators let you wrap every Story with shared context, such as a theme Provider, a Redux store, or a Router:

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

You can also add a Decorator at the individual Story level:

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

## Organizing Story Directory Structure

It's recommended to organize Story files to mirror your actual component directory structure:

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

Configure the file-matching rules in `.storybook/config.js`:

```js
const req = require.context('../src', true, /\.stories\.(js|tsx)$/);
```

## Integrating with Accessibility Checks

Storybook is a great fit as a documentation site for a component library. You can pair it with `@storybook/addon-a11y` to run accessibility checks:

```js
// .storybook/config.js
import { withA11y } from '@storybook/addon-a11y';

addDecorator(withA11y);
```

This way every Story panel shows its accessibility check results, helping you keep components accessible.

## Building Static Sites

Storybook can be built into a static HTML site, which makes it easy to deploy to any static hosting service:

```bash
npm run build-storybook
```

The build output lands in the `storybook-static` directory and can be deployed to GitHub Pages, Netlify, or an internal server.

```json
{
  "scripts": {
    "storybook": "start-storybook -p 9009",
    "build-storybook": "build-storybook -o docs",
    "deploy-storybook": "storybook-to-ghpages"
  }
}
```

## Summary

- Storybook provides an isolated component development environment, independent of business context
- CSF (Component Story Format) is the recommended way to write stories
- The Knobs addon supports dynamically adjusting props, making interactive debugging easy
- The Actions addon can capture and display a component's event callbacks
- Custom Webpack config supports CSS Modules, TypeScript, and similar tooling
- Decorators can provide global or local context wrapping
- addon-docs supports writing component docs in MDX format
- It can be built into a static site for easy team sharing and deployment
