---
title: "Vite開発サーバーの原理：ESMベースの超高速ホットリロード"
date: 2020-05-09 17:09:28
tags:
  - エンジニアリング
readingTime: 3
description: "Vite 1.0 在 2020 年发布后，\"秒级启动\"让很多人惊叹。本文深入分析 Vite 能做到这一点的底层原理，以及它和 webpack dev server 的根本区别。"
wordCount: 680
---

Vite 1.0 が 2020 年に登場し、「秒単位の起動」に多くの開発者が驚いた。本記事では、Vite がそれを実現できた根底の仕組みと、webpack dev server との根本的な違いを深掘りする。

## 従来のwebpackのボトルネック

webpack は起動時に**まずバンドルしてから提供する**必要がある：

```
启动 webpack dev server：
1. 解析所有入口和依赖树（可能几千个模块）
2. 转换每个模块（TS→JS、Less→CSS 等）
3. 将所有模块打包成 bundle
4. 启动 HTTP 服务，提供 bundle
→ 冷启动时间：几十秒到几分钟（大型项目）
```

これは、1 つのファイルを変更すると、webpack は影響を受けたチャンク全体を再ビルドし、WebSocket 経由で更新を送る必要があることを意味する。

## ViteのNo-bundleアプローチ

```
启动 Vite dev server：
1. 仅预构建 node_modules 中的依赖（esbuild，极快）
2. 启动 HTTP 服务
→ 冷启动时间：< 1 秒

浏览器请求页面时：
按需转换被请求的模块（而不是提前打包所有模块）
```

これは、モダンブラウザが ES Module をネイティブにサポートしていることに依っている：

```html
<!-- index.html -->
<script type="module" src="/src/main.ts"></script>
```

ブラウザは `type="module"` を見ると、自ら `import` 文を解析してリクエストを発行する。Vite はリクエストされたファイルをサーバー側で変換するだけでよい：

```javascript
// 浏览器请求 /src/App.vue
// Vite 服务端接收请求，实时转换：
// 1. 解析 .vue 文件的 template、script、style
// 2. 将 template 编译成 render function
// 3. 返回 ES module 格式的 JS
```

## 依存预构建

`node_modules` 内のパッケージは通常 CommonJS 形式であり、ブラウザから直接 `import` できない。Vite は初回起動時に **esbuild** でこれらの依存をプリビルドする：

```
# Vite 启动时的预构建
node_modules/lodash-es → .vite/lodash-es.js  （合并成单文件，减少请求数）
node_modules/vue       → .vite/vue.js
...
```

esbuild は Go で書かれたバンドラーで、webpack の 10〜100 倍速く、この手順は通常数百ミリ秒で完了する。

## HMR 実装原理

Vite の HMR は webpack よりも的確だ：

```javascript
// Vite HMR 协议
// 当 src/components/Button.vue 被修改时：
// 1. Vite 文件监听器检测到变化
// 2. 分析该文件的 HMR 边界
// 3. 仅使这个文件的模块缓存失效
// 4. 通过 WebSocket 通知浏览器
// 5. 浏览器重新请求这个文件（而不是整个 bundle）

// 组件内接收 HMR
if (import.meta.hot) {
  import.meta.hot.accept("./Button.vue", (newModule) => {
    // 替换模块
  });
}
```

Vue や React 向けの HMR プラグイン（`@vitejs/plugin-vue`、`@vitejs/plugin-react`）がコンポーネント単位のホット更新を自動で処理するため、開発者が上記のコードを自分で書く必要はふつうない。

## 与 webpack 的对比

|            | webpack dev server     | Vite           |
| ---------- | ---------------------- | -------------- |
| コールドスタート | 遅い（すべてのモジュールをバンドル必要） | 速い（必要に応じて変換） |
| HMR 速度   | ミリ秒〜秒（プロジェクト規模依存）  | 常にミリ秒級     |
| 本番ビルド   | webpack                | Rollup         |
| 設定の複雑さ | 高い                     | 低い             |
| 互換性     | IE11+                  | モダンブラウザ     |

## vite.config.js 基础配置

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: { "@": "/src" },
  },
});
```

## まとめ

Vite の速さは webpack を最適化したのではなく、**バンドルというステップを迂回した**ことにある。ブラウザネイティブな ESM と esbuild のプリビルドを組み合わせ、「まずバンドルしてから提供」を「必要に応じた変換」に変えた。この考え方は、次世代のフロントエンドツールチェーンを理解する上で非常に重要だ。
