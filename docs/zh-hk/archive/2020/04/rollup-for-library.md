---
title: "Rollup 打包前端庫最佳實踐"
date: 2020-04-28 10:29:03
tags:
  - 工程化
readingTime: 2
description: "用 Webpack 打包應用，但打包庫的時候 Rollup 更合適。為什麼？因為 Rollup 產物更乾淨、更小。記錄一下用 Rollup 打包一個 Vue 組件庫的全過程。"
---

用 Webpack 打包應用，但打包庫的時候 Rollup 更合適。為什麼？因為 Rollup 產物更乾淨、更小。記錄一下用 Rollup 打包一個 Vue 組件庫的全過程。

## 為什麼庫用 Rollup 不用 Webpack

```markdown
|          | Webpack          | Rollup           |
|
----------|------------------|------------------|
| 定位     | 應用打包          | 庫打包            |
| 產物格式 | 自有格式          | ESM / CJS / UMD  |
| 產物體積 | 較大（運行時多）   | 較小（無運行時）   |
| Tree Shaking | 支持          | 更徹底           |
| Code Splitting | 支持         | 有限             |
```

簡單説：Webpack 管理應用，Rollup 打包庫。

## 項目結構

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
    // ESM 格式（現代構建工具使用）
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
    // UMD 格式（瀏覽器直接使用）
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

## 處理樣式

```javascript
// rollup.config.js 樣式相關配置
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';

// CSS 提取為獨立文件
postcss({
  extract: 'style.css',      // 提取到 style.css
  minimize: true,             // 壓縮
  plugins: [autoprefixer()],  // 自動加前綴
  // 支持 CSS Modules
  modules: true,
});

// 或者內聯到 JS 中（適合 Tree Shaking）
postcss({
  inject: true,  // 注入到 <style> 標籤
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
// babel-plugin-import 方式（額外配置）
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

## TypeScript 類型導出

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

## 小結

- Rollup 產物更乾淨，適合打包庫；Webpack 適合打包應用
- 輸出 ESM + CJS + UMD 三種格式，滿足不同使用場景
- `peerDependencies` 聲明 Vue 版本，不把 Vue 打包進去
- `sideEffects` 聲明副作用文件，讓使用者能按需引入
- 樣式建議提取為獨立 CSS 文件，而不是內聯到 JS
