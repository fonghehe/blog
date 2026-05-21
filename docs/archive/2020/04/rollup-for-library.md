---
title: "Rollup 打包前端库最佳实践"
date: 2020-04-28 10:29:03
tags:
  - 工程化
readingTime: 2
description: "用 Webpack 打包应用，但打包库的时候 Rollup 更合适。为什么？因为 Rollup 产物更干净、更小。记录一下用 Rollup 打包一个 Vue 组件库的全过程。"
wordCount: 187
---

用 Webpack 打包应用，但打包库的时候 Rollup 更合适。为什么？因为 Rollup 产物更干净、更小。记录一下用 Rollup 打包一个 Vue 组件库的全过程。

## 为什么库用 Rollup 不用 Webpack

```markdown
|          | Webpack          | Rollup           |
|
----------|------------------|------------------|
| 定位     | 应用打包          | 库打包            |
| 产物格式 | 自有格式          | ESM / CJS / UMD  |
| 产物体积 | 较大（运行时多）   | 较小（无运行时）   |
| Tree Shaking | 支持          | 更彻底           |
| Code Splitting | 支持         | 有限             |
```

简单说：Webpack 管理应用，Rollup 打包库。

## 项目结构

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

## 处理样式

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

## 按需引入配置

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

## TypeScript 类型导出

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

## 小结

- Rollup 产物更干净，适合打包库；Webpack 适合打包应用
- 输出 ESM + CJS + UMD 三种格式，满足不同使用场景
- `peerDependencies` 声明 Vue 版本，不把 Vue 打包进去
- `sideEffects` 声明副作用文件，让使用者能按需引入
- 样式建议提取为独立 CSS 文件，而不是内联到 JS
