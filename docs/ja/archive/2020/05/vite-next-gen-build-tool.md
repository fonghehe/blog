---
title: "Vite：次世代フロントエンドビルドツール体験"
date: 2020-05-20 17:39:20
tags:
  - エンジニアリング
readingTime: 2
description: "尤雨溪在直播中介绍了 Vite（法语\"快\"的意思），我立刻拿来试了试。感觉颠覆了我对开发工具的认知。"
wordCount: 498
---

尤雨渓（Evan You）がライブ配信で Vite（フランス語で「速い」という意味）を紹介したので、すぐに試してみた。開発ツールに対する認識が覆される思いだった。

## コアアイデア：ブラウザネイティブES Modulesの活用

従来の開発サーバー（Webpack dev server）：

- 起動時にすべてのモジュールをバンドルする
- プロジェクトが大きいほど起動に時間がかかる（うちのプロジェクトでは現在 60 秒）
- ホット更新でも関連モジュールを再バンドルする

Vite のアプローチ：

- 起動時は**バンドルせず**、ブラウザネイティブな ESM をそのまま活用する
- ブラウザが要求したモジュールだけを処理する
- 起動時間はほぼ一定（プロジェクトの規模に依らない）

```
浏览器请求 /src/main.ts
 → Vite 拦截，实时编译 TypeScript
 → 返回 ES Module
 → 浏览器解析 import，发出新请求
 → Vite 处理新请求...
```

## 実際の体験

```bash
npm init vite-app my-app
cd my-app
npm install
npm run dev  # 500ms 启动！（Webpack 要 60s）
```

```javascript
// vite.config.js
module.exports = {
  // 配置极简
  alias: {
    "@": "/src",
  },
  optimizeDeps: {
    // 预优化：把 CommonJS 依赖转为 ESM（只做一次）
    include: ["lodash-es", "axios"],
  },
};
```

## 和 Webpack 的区别

```javascript
// Webpack：需要大量配置才能支持 TypeScript
module.exports = {
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader" },
      { test: /\.vue$/, use: "vue-loader" },
      { test: /\.scss$/, use: ["style-loader", "css-loader", "sass-loader"] },
    ],
  },
  plugins: [...很多插件],
};

// Vite：内置支持，零配置
// TypeScript、Vue、React、CSS、SCSS... 都开箱即用
```

## HMR 热更新

```
Webpack HMR：
  文件变化 → 重新编译相关模块链 → 替换

Vite HMR：
  文件变化 → 直接发 invalidation 信号 → 浏览器重新请求该模块

  速度快很多，而且和项目大小无关
```

## 生产构建：基于 Rollup

```javascript
// 生产环境用 Rollup 打包（ESM + Tree Shaking）
// 不是直接服务 ESM（浏览器大量 HTTP 请求不适合生产）

// vite.config.js
module.exports = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "vuex"],
        },
      },
    },
  },
};
```

## 2020 年 5 月の現状

- Vue 3 のみ対応（当時）
- API はまだ不安定（Vite 1.0 は年末予定）
- 一部のエッジケースの処理が不十分
- SSR サポートはまだ発展途上

しかしこの方向性は間違いなく正しいと確信している。1.0 が安定してからプロジェクトで使うつもりだ。

## まとめ

- Vite はネイティブな ESM を活用し、開発サーバーの起動はほぼ瞬時だ
- TS・Vue・React・CSS プリプロセッサをゼロコンフィグでサポートする
- 本番ビルドは Rollup を用い、ESM と従来形式の両方を出力する
- 2020 年時点ではまだ成熟しておらず、2021 年の Vite 2 で本番利用を再評価する
