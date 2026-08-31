---
title: "esbuild：Go で書き直された JS バンドラー"
date: 2021-02-08 09:51:13
tags:
  - React
  - Angular
  - Webpack
  - Vite
  - JavaScript
  - TypeScript
  - CSS
  - Node.js

readingTime: 4
description: "esbuild 是 Evan Wallace 在 2020 年发布的 JavaScript/TypeScript 打包器，用 Go 语言编写。它不是最快的 JS 打包器，它是快到不真实的那种——比 Webpack 快 100 倍，比 Parcel 快 100 倍，比 Rollup 快数倍。Vite 用它做依赖预构建，S"
wordCount: 1017
---

esbuild は Evan Wallace が 2020 年に公開した JavaScript/TypeScript 向けのバンドラーで、Go 言語で書かれている。最速の JS バンドラーというわけではないが、その速さは信じられないほどだ。Webpack の約 100 倍、Parcel の約 100 倍、Rollup の数倍の速さである。Vite は依存関係のプリビルドに esbuild を使い、Snowpack も esbuild を統合している。

## なぜこんなに速いのか

esbuild がこれほど速い理由は 3 つある：

1. **Go 言語**：コンパイル言語であり、元々 JS より速い。Go の並行モデル（goroutine）も並列処理をより効率的にする。
2. **ゼロからの実装**：acorn や babel といった既存の JS ライブラリを一切使わず、parser と bundler をすべて自前で実装している。
3. **メモリ最適化**：データ構造を可能な限りコンパクトにし、メモリ割り当てと GC の負荷を減らしている。

```bash
# 实际测试：打包 10 个 Three.js 拷贝
# esbuild:  ~47ms
# Webpack:  ~4,250ms
# Rollup:   ~1,780ms
# Parcel:   ~4,500ms
```

## 基本的な使い方

```bash
# 全局安装
npm install -g esbuild

# 打包单文件
esbuild app.ts --bundle --outfile=out.js

# 打包为生产环境
esbuild app.ts --bundle --minify --outfile=out.js

# 多入口
esbuild src/home.ts src/about.ts --bundle --outdir=dist
```

## API 使用

esbuild には CLI と API の 2 つの使い方があり、API の方が柔軟だ：

```javascript
const esbuild = require('esbuild')

// 构建
async function build() {
  const result = await esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    outdir: 'dist',
    format: 'esm',
    splitting: true, // 代码分割（ESM 格式下可用）
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    loader: {
      '.tsx': 'tsx',
      '.css': 'css',
      '.png': 'dataurl',
      '.svg': 'text'
    },
    external: ['react', 'react-dom'], // 不打包这些
    plugins: [
      // 插件示例
      {
        name: 'env-plugin',
        setup(build) {
          build.onResolve({ filter: /^env$/ }, () => ({
            path: 'env',
            namespace: 'env-ns'
          }))
          build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
            contents: JSON.stringify(process.env),
            loader: 'json'
          }))
        }
      }
    ]
  })

  console.log(`构建完成，输出 ${result.outputFiles.length} 个文件`)
}

build()
```

## Watch モード

```javascript
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  sourcemap: true
})

// 监听文件变化
await ctx.watch()

// 启动开发服务器（esbuild 0.17+）
await ctx.serve({
  port: 3000,
  servedir: 'dist'
})
```

## Vite における esbuild の役割

Vite は次の 2 つの重要な箇所で esbuild を使っている：

1. **依存関係のプリビルド**：開発段階で、CommonJS の依存を ESM に変換し、多くの内部モジュールを 1 つのファイルにまとめる。
2. **本番ビルドのコード圧縮**：Vite 2.7 以降は esbuild による minify に対応しており、Terser よりずっと速い。

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // esbuild 预构建配置
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    // Vite 2.7+ 使用 esbuild 压缩
    minify: 'esbuild', // 'terser' | 'esbuild'
    target: 'es2015'
  }
})
```

## 現在の限界

esbuild は万能ではなく、明確な制限がいくつかある：

1. **コード分割を持たない IIFE 形式**：ESM 形式は `splitting` に対応するが、従来の形式は対応していない。
2. **デコレータ構文の変換に非対応**：Angular プロジェクトではそのまま使えない。
3. **HMR に非対応**：HMR は自前で実装せず、上位フレームワークでの対応が必要だ。
4. **プラグインエコシステムが小さい**：Webpack のプラグインはそのまま移行できない。
5. **CSS の処理が限定的**：CSS Modules や PostCSS などの高度な機能には対応していない。

```javascript
// ❌ 不支持装饰器
@Component({ template: '<div/>' })
class MyComponent { }

// ❌ 不支持 CSS Modules（需要自行处理）
import styles from './app.module.css'
```

## Webpack とのポジショニングの違い

esbuild は Webpack の代替ではない。少なくとも現時点ではそうだ。esbuild の位置づけはむしろ次のようなものだ：

- **ビルドの高速化ツール**：既存のツールチェーンで最も遅い箇所（TS のコンパイル、バンドル、圧縮）を置き換える。
- **プロトタイピングツール**：小規模なプロジェクトやライブラリのバンドルに向き、設定がシンプルだ。
- **基盤となるインフラ**：Vite や Snowpack などのツールの内部エンジンだ。

```javascript
// Webpack 用户的渐进式采用方式
// 1. 用 esbuild-loader 替代 babel-loader + ts-loader
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',    // tsx 文件用 tsx loader
          target: 'es2015'
        }
      }
    ]
  },
  plugins: [
    // 2. 用 EsbuildPlugin 替代 TerserPlugin 做压缩
    new EsbuildPlugin({
      target: 'es2015',
      css: true
    })
  ]
}
```

## まとめ

- esbuild は Go で書かれており、従来のツールの約 100 倍の速さを出す。これはマーケティングの言葉ではなく、実測の数値だ。
- 基盤となる高速化ツールとして適しており（Vite、Snowpack はすでに統合済み）、Webpack の完全な代替としては向かない。
- Webpack ユーザーは esbuild-loader で段階的に高速化できる。
- プラグインエコシステム、CSS 処理、HMR はまだ成熟していないため、注視しつつも安易に全面移行すべきではない。
- これは一つの潮流を示している。フロントエンドのツールチェーンは JS からコンパイル言語へ移りつつある。
