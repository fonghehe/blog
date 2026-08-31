---
title: "Storybookコンポーネント開発環境の構築"
date: 2019-10-07 14:56:30
tags:
  - テスト
readingTime: 6
description: "在组件化开发成为主流的今天，如何高效地开发、测试和文档化独立组件是一个重要课题。Storybook 是一个开源的 UI 组件开发环境，它让你可以在隔离环境中构建和展示组件，不依赖业务代码。本文将从零搭建一个完整的 Storybook 开发环境。"
wordCount: 1231
---

コンポーネントベースの開発が主流となった今、独立したコンポーネントをいかに効率的に開発・テスト・ドキュメント化するかは重要な課題です。Storybook はオープンソースの UI コンポーネント開発環境であり、業務コードに依存せず隔離された環境でコンポーネントを構築・展示できます。本記事ではゼロから完成した Storybook 開発環境を構築します。

## プロジェクトの初期化

React プロジェクトを例に、`npx` で Storybook を初期化します：

```bash
npx -p @storybook/cli sb init
```

初期化が完了すると、依存関係が自動でインストールされ、`.storybook` 設定ディレクトリと `stories` サンプルディレクトリが作成されます。プロジェクト構成は以下のとおりです：

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

Story とは、コンポーネントがある状態で表示される姿のことです。Component Story Format（CSF）の使用を推奨します。これは Storybook 5.2 で導入された新しいフォーマットです：

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

エクスポートされた各関数が独立した Story となり、Storybook のサイドバーから個別に確認・操作できます。

## Knobsプラグインで動的にPropsを調整

`@storybook/addon-knobs` は最もよく使われるアドオンの一つであり、Storybook パネル上でコンポーネントの props を動的に調整できます：

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

`.storybook/addons.js` でアドオンを登録します：

```js
import '@storybook/addon-knobs/register';
import '@storybook/addon-actions/register';
import '@storybook/addon-links/register';
```

## Actionsプラグインでイベントをキャプチャ

Actions アドオンは、Storybook パネル上でコンポーネントが発火したイベントコールバックを確認でき、インタラクションのデバッグに便利です：

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

プロジェクトで CSS Modules や TypeScript などを使っている場合、Storybook の Webpack 設定を拡張する必要があります：

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

Storybook 5.2 で `@storybook/addon-docs` が導入され、MDX フォーマットでドキュメントを書く方が直感的になります：

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

Decorators を使うと、各 Story に統一したコンテキスト（テーマ Provider、Redux Store、Router など）を追加できます：

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

単一の Story レベルで Decorator を追加することもできます：

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

コンポーネントの実際のディレクトリ構成に合わせて Story ファイルを整理することを推奨します：

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

`.storybook/config.js` でファイルのマッチングルールを設定します：

```js
const req = require.context('../src', true, /\.stories\.(js|tsx)$/);
```

## アクセシビリティチェックとの統合

Storybook はコンポーネントライブラリのドキュメントサイトとして非常に適しています。`@storybook/addon-a11y` と組み合わせてアクセシビリティ（a11y）チェックを行えます：

```js
// .storybook/config.js
import { withA11y } from '@storybook/addon-a11y';

addDecorator(withA11y);
```

これにより、各 Story パネルにアクセシビリティのチェック結果が表示され、コンポーネントのアクセシビリティ確保に役立ちます。

## 静的サイトの構築

Storybook は静的 HTML サイトとしてビルドでき、任意の静的ホスティングサービスへデプロイしやすくなります：

```bash
npm run build-storybook
```

ビルド成果物は `storybook-static` ディレクトリに出力され、GitHub Pages、Netlify、または社内サーバーへデプロイできます。

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

- Storybook は業務コンテキストに依存しない隔離されたコンポーネント開発環境を提供する
- CSF（Component Story Format）は推奨される Story の記述フォーマットです
- Knobs アドオンは props の動的調整をサポートし、インタラクティブなデバッグに便利です
- Actions アドオンはコンポーネントのイベントコールバックを捕捉・表示できます
- カスタム Webpack 設定は CSS Modules や TypeScript などに対応します
- Decorators はグローバルまたはローカルなコンテキストのラップを提供できます
- addon-docs は MDX フォーマットでのコンポーネントドキュメント記述をサポートします
- 静的サイトとしてビルドでき、チームでの共有やデプロイに便利です
