---
title: "Rollupによるフロントエンドライブラリのバンドルベストプラクティス"
date: 2020-04-28 10:29:03
tags:
  - エンジニアリング
readingTime: 3
description: "アプリケーションのバンドルには Webpack、ライブラリのバンドルには Rollup の方が適しています。なぜなら、Rollup の出力はよりクリーンで軽量だからです。Rollup を使って Vue コンポーネントライブラリをバンドルした全プロセスを記録します。"
wordCount: 372
---

アプリケーションのバンドルには Webpack、ライブラリのバンドルには Rollup の方が適しています。なぜなら、Rollup の出力はよりクリーンで軽量だからです。Rollup を使って Vue コンポーネントライブラリをバンドルした全プロセスを記録します。

## ライブラリにWebpackではなくRollupを使う理由

```markdown
|          | Webpack          | Rollup           |
|----------|------------------|------------------|
| 用途     | アプリケーションのバンドル | ライブラリのバンドル  |
| 出力形式 | 独自形式          | ESM / CJS / UMD  |
| 出力サイズ | 大きい（ランタイム含む） | 小さい（ランタイムなし） |
| Tree Shaking | 対応          | より徹底          |
| Code Splitting | 対応         | 限定的            |
```

簡単に言うと：Webpack はアプリケーション管理、Rollup はライブラリのバンドルに使用します。

## プロジェクト構造

```
my-component-lib/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.vue
│   │   │   └── index.ts
│   │   └── Input/
│   │       ├── Input.vue
│   │       └── index.ts
│   ├── utils/
│   │   └── helpers.ts
│   └── index.ts          # エントリーポイント
├── rollup.config.js
├── tsconfig.json
├── package.json
```

```typescript
// src/index.ts
export { default as Button } from './components/Button/Button.vue';
export { default as Input } from './components/Input/Input.vue';
export { formatCurrency, formatPhone } from './utils/helpers';
```

## rollup.config.js

```javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import vue from 'rollup-plugin-vue';
import postcss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

export default {
  input: 'src/index.ts',
  external: [...external, /^vue/],
  plugins: [
    resolve({
      extensions: ['.js', '.ts', '.vue'],
    }),
    commonjs(),
    vue({
      css: false,
    }),
    postcss({
      extract: 'style.css',
      minimize: true,
    }),
    typescript({
      tsconfig: './tsconfig.json',
      useTsconfigDeclarationDir: true,
    }),
    terser(),
  ],
  output: [
    // ESM 形式（モダンなビルドツール向け）
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    // CommonJS 形式（Node.js / Webpack 向け）
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    // UMD 形式（ブラウザで直接使用）
    {
      file: pkg.unpkg,
      format: 'umd',
      name: 'MyUI',
      globals: {
        vue: 'Vue',
      },
      sourcemap: true,
    },
  ],
};
```

## package.json

```json
{
  "name": "@company/my-ui",
  "version": "0.1.0",
  "main": "lib/index.cjs.js",
  "module": "lib/index.esm.js",
  "unpkg": "lib/index.umd.js",
  "types": "lib/index.d.ts",
  "files": ["lib", "types"],
  "sideEffects": ["*.css", "*.vue"],
  "peerDependencies": {
    "vue": "^2.6.0"
  },
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w"
  },
  "devDependencies": {
    "@rollup/plugin-commonjs": "^11.0.0",
    "@rollup/plugin-node-resolve": "^7.0.0",
    "rollup": "^2.0.0",
    "rollup-plugin-postcss": "^3.0.0",
    "rollup-plugin-terser": "^5.0.0",
    "rollup-plugin-typescript2": "^0.27.0",
    "rollup-plugin-vue": "^5.0.0",
    "typescript": "^3.8.0",
    "vue": "^2.6.0",
    "vue-template-compiler": "^2.6.0"
  }
}
```

## スタイルの処理

```javascript
// rollup.config.js スタイル関連の設定
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';

// CSS を独立したファイルとして抽出
postcss({
  extract: 'style.css',      // style.css に抽出
  minimize: true,             // 圧縮
  plugins: [autoprefixer()],  // 自動でプレフィックスを付与
  // CSS Modules をサポート
  modules: true,
});

// または JS にインライン化（Tree Shaking に適している）
postcss({
  inject: true,  // <style> タグに注入
  minimize: true,
});
```

## 必要なものだけをインポートする設定

```json
// package.json
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

```javascript
// 必要なものだけをインポート（Tree Shaking 対応）
import { Button } from '@company/my-ui';

// ではなく
import * as MyUI from '@company/my-ui';
```

```javascript
// babel-plugin-import 方式（追加設定）
// babel.config.js
module.exports = {
  plugins: [
    ['import', {
      libraryName: '@company/my-ui',
      libraryDirectory: 'lib',
      style: 'style.css',
    }],
  ],
};
```

## TypeScript 型のエクスポート

```json
// tsconfig.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "lib",
    "emitDeclarationOnly": false,
    "declarationMap": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

## まとめ

- Rollup の出力はよりクリーンで、ライブラリのバンドルに適しています。Webpack はアプリケーションのバンドルに適しています
- ESM、CJS、UMD の3種類の形式を出力し、さまざまなユースケースに対応
- `peerDependencies` で Vue のバージョンを宣言し、Vue をバンドルに含めない
- `sideEffects` で副作用ファイルを宣言し、利用者が必要なものだけをインポート可能に
- スタイルは JS にインライン化するのではなく、独立した CSS ファイルに抽出することを推奨
