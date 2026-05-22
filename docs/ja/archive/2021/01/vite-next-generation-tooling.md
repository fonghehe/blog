---
title: "Vite 2.0：真の次世代ビルドツール"
date: 2021-01-11 11:18:56
tags:
  - Vue
  - React
  - Webpack
  - Vite
  - JavaScript
  - CSS
  - Node.js

readingTime: 5
description: "Evan You は2021年1月に Vite 2.0 正式版をリリースしました。1.0 と比較すると、これはほぼ完全な書き直しであり、最大の変更点はフレームワーク非依存となり、Vue エコシステムだけでなくなったことです。Webpack 1 の時代から使い続けてきたフロントエンドエンジニアとして、Vite がもたらしたのは「速い」というだけでなく、開発体験の全面的な向上だと感じています。"
wordCount: 1264
---

Evan You は 2021 年 1 月に Vite 2.0 正式版をリリースしました。1.0 と比較すると、これはほぼ完全な書き直しであり、最大の変更点はフレームワーク非依存となり、Vue エコシステムだけでなくなったことです。Webpack 1 の時代から使い続けてきたフロントエンドエンジニアとして、Vite がもたらしたのは「速い」というだけでなく、開発体験の全面的な向上だと感じています。

## なぜ Vite は速いのか

従来のビルドツール（Webpack、Rollup）は開発段階でアプリケーション全体を先にバンドルしてから dev server を起動する必要があります。プロジェクトが大きいほど、コールドスタートが遅くなります。Vite のアプローチはまったく異なります：

```
Webpack: ソースコード → bundle にバンドル → dev server 起動 → ブラウザが bundle をロード
Vite:    dev server 起動 → ブラウザが必要に応じてモジュールをリクエスト → 個別にコンパイル
```

核心原理は、ブラウザのネイティブ ES Module サポートを利用することです。開発時はバンドルせず、ブラウザからのリクエストに応じてオンデマンドでコンパイルします：

```javascript
// ブラウザがこのファイルをリクエストしたときに、Vite がコンパイルを実行
// src/App.vue → コンパイル後にブラウザに返却
import { createApp } from 'vue' // これもブラウザによって個別にリクエストされます
import App from './App.vue'

createApp(App).mount('#app')
```

コールドスタート時間は Webpack の 30〜60 秒から 1 秒未満に短縮されました。これは理論値ではなく、実際のプロジェクトでの体感です。

## フレームワーク非依存：Vueだけではない

Vite 2.0 のプラグインシステムは Rollup と互換性があり、複数のフレームワークをサポートしています：

```bash
# Vue 3
npm init vite@latest my-vue-app -- --template vue

# React
npm init vite@latest my-react-app -- --template react

# Preact
npm init vite@latest my-preact-app -- --template preact

# Svelte
npm init vite@latest my-svelte-app -- --template svelte
```

最近、React プロジェクトを CRA から Vite に移行しましたが、コールドスタートが 45 秒から 1.2 秒に短縮され、HMR の遅延もほぼ感じられなくなりました。

## プラグインシステム

Vite 2.0 のプラグイン API は Rollup のプラグインインターフェースをベースに拡張されており、Rollup プラグインを書いたことのあるフロントエンドエンジニアにとって学習コストはほぼゼロです：

```javascript
// vite-plugin-my-feature.js
export default function myPlugin() {
  return {
    name: 'vite-plugin-my-feature',

    // 開発段階のフック
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        '<head>\n<script>window.__APP_VERSION__ = "1.0.0"</script>'
      )
    },

    // 特定のファイルを処理
    transform(code, id) {
      if (id.endsWith('.svg')) {
        return `export default ${JSON.stringify(code)}`
      }
    },

    // dev server の設定
    configureServer(server) {
      server.middlewares.use('/api/mock', (req, res) => {
        res.end(JSON.stringify({ data: 'mock' }))
      })
    }
  }
}
```

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import myPlugin from './vite-plugin-my-feature'

export default defineConfig({
  plugins: [vue(), myPlugin()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

## Webpack との本質的な違い

| 観点 | Webpack 4/5 | Vite 2 |
|------|------------|--------|
| 開発ビルド | 全量バンドル | オンデマンドコンパイル |
| 本番ビルド | webpack | Rollup |
| コールドスタート | 遅い（プロジェクト規模に比例） | 速い（ほぼ無関係） |
| HMR | 影響を受けるモジュールチェーンを再構築 | 正確に更新し、変更されたモジュールのみ処理 |
| 設定 | 複雑、loader + plugin | シンプル、Rollup 互換プラグイン |

見落としがちな点：Vite の本番ビルドは Rollup を使用しており、Rollup は tree-shaking とコード最適化において業界最高の選択肢です。つまり、開発では Vite のオンデマンド戦略、本番では Rollup の成熟したバンドルを採用しており、両方の面で最適化されています。

## Webpack からの移行の実際の経験

```bash
# 1. Vite をインストール
npm install -D vite @vitejs/plugin-vue

# 2. package.json を修正
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}

# 3. vite.config.ts を作成
```

いくつかのよくある移行時の注意点：

```javascript
// ❌ process.env は Vite では使用不可（開発段階は ESM であり、Node 環境がない）
const apiUrl = process.env.VUE_APP_API_URL

// ✅ import.meta.env を使用し、プレフィックスを VITE_ に変更
const apiUrl = import.meta.env.VITE_API_URL

// .env ファイル
// VUE_APP_API_URL=https://api.example.com  →  VITE_API_URL=https://api.example.com
```

```javascript
// ❌ require() は使用不可
const modules = require.context('./modules', true, /\.ts$/)

// ✅ ESM の動的インポートに変更
const modules = import.meta.glob('./modules/**/*.ts')

// 遅延読み込み版
const modules = import.meta.glob('./modules/**/*.ts')
```

CSS プリプロセッサはローダーの追加設定が不要で、依存関係をインストールするだけです：

```bash
npm install -D sass
# これで完了、.vue ファイル内で lang="scss" を直接使用可能
```

## まだ成熟していない点

公平に見て、Vite 2.0 にはいくつかの不足もあります：

1. **CommonJS 依存関係**：開発段階で事前ビルド（esbuild）が必要で、互換性の問題に遭遇することがある
2. **SSR サポート**：基本的な枠組みはあるが、Nuxt のようにすぐに使えるほどではない
3. **エコシステム**：プラグイン数は Webpack に及ばないが、コアシーンはほぼカバーできている
4. **古いブラウザ**：デフォルトではネイティブ ESM 対応ブラウザのみサポート、IE 互換性が必要なプロジェクトには当面不向き

## まとめ

- Vite 2.0 は「速い」だけでなく、アーキテクチャレベルでフロントエンドビルドツールのパラダイムを変えました
- フレームワーク非依存で、Vue/React/Svelte すべてで使用可能、Rollup プラグイン互換により移行コストが低減
- 移行時の注意点：`process.env` → `import.meta.env`、`require` → `import`
- 新規プロジェクトは Vite を直接推奨、既存プロジェクトは移行コストを評価
- 2021年のフロントエンドビルドツールの競争環境は変わり、Vite は本命の選択肢です
