---
title: "Rollup: Best Practices for Bundling Frontend Libraries"
date: 2020-04-28 10:29:03
tags:
  - Engineering
readingTime: 2
description: "Use Webpack to bundle applications, but Rollup is the better fit for libraries. Why? Because Rollup produces cleaner, smaller output. Here I document the full process of bundling a Vue component library with Rollup."
wordCount: 120
---

Use Webpack to bundle applications, but Rollup is the better fit for libraries. Why? Because Rollup produces cleaner, smaller output. Here I'll document the full process of bundling a Vue component library with Rollup.

## Why Use Rollup Instead of Webpack for Libraries

```markdown
|          | Webpack          | Rollup           |
|----------|------------------|------------------|
| 定位     | 应用打包          | 库打包            |
| 产物格式 | 自有格式          | ESM / CJS / UMD  |
| 产物体积 | 较大（运行时多）   | 较小（无运行时）   |
| Tree Shaking | 支持          | 更彻底           |
| Code Splitting | 支持         | 有限             |
```

In short: Webpack manages applications, while Rollup bundles libraries.

## Project Structure

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
│   └── index.ts          # 入口
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
    // ESM 格式（现代构建工具使用）
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    // CommonJS 格式（Node.js / Webpack 使用）
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    // UMD 格式（浏览器直接使用）
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

## Handling Styles

```javascript
// rollup.config.js 样式相关配置
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';

// CSS 提取为独立文件
postcss({
  extract: 'style.css',      // 提取到 style.css
  minimize: true,             // 压缩
  plugins: [autoprefixer()],  // 自动加前缀
  // 支持 CSS Modules
  modules: true,
});

// 或者内联到 JS 中（适合 Tree Shaking）
postcss({
  inject: true,  // 注入到 <style> 标签
  minimize: true,
});
```

## On-Demand Import Configuration

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
// 使用方按需引入（配合 Tree Shaking）
import { Button } from '@company/my-ui';

// 而不是
import * as MyUI from '@company/my-ui';
```

```javascript
// babel-plugin-import 方式（额外配置）
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

## Exporting TypeScript Types

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

## Summary

- Rollup produces cleaner output and suits libraries, whereas Webpack suits applications.
- Emitting ESM + CJS + UMD covers different consumption scenarios.
- Declare the Vue version via `peerDependencies` so Vue isn't bundled in.
- Mark side-effect files with `sideEffects` so consumers can import on demand.
- Extract styles into a standalone CSS file rather than inlining them into JS.
