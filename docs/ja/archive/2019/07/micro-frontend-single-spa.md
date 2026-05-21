---
title: "マイクロフロントエンドの実践：single-spa を使用して"
date: 2019-07-12 10:26:31
tags:
  - マイクロフロントエンド
  - エンジニアリング
readingTime: 3
description: "会社のレガシーバックエンドシステムは2016年の jQuery プロジェクトでした。新機能には Vue を使いたかったのですが、全面書き直しはできませんでした。マイクロフロントエンドがこの問題を解決しました。"
wordCount: 638
---

会社のレガシーバックエンドシステムは2016年の jQuery プロジェクトでした。新機能には Vue を使いたかったのですが、全面書き直しはできませんでした。マイクロフロントエンドがこの問題を解決しました。

## 私たちのシナリオ

- レガシーシステム：jQuery + Bootstrap、数十ページ
- 新要件：新モジュールを Vue CLI 3 で開発したい
- 目標：新旧共存、段階的移行、統一ナビゲーション

## なぜ single-spa を選んだか

2019年当時、マイクロフロントエンドフレームワークは多くありませんでした：

- single-spa：最も成熟しており、複数フレームワークをサポート
- qiankun（アリババ）：single-spa ベースで API がより使いやすい（調査時はまだ1.0に達していなかった）

最終的に single-spa を選びました。

## アーキテクチャ設計

```
メインアプリ（Shell）
├── 共通ナビゲーション、認証、ルーティング登録
├── サブアプリ A（レガシー jQuery）- /legacy/*
├── サブアプリ B（Vue 2）- /orders/*
└── サブアプリ C（Vue 2）- /analytics/*
```

## メインアプリ（Shell）

```javascript
// shell/src/index.js
import { registerApplication, start } from "single-spa";

// レガシーシステム（jQuery）を登録
registerApplication(
  "legacy",
  () => import("./apps/legacy-app"),
  (location) => location.pathname.startsWith("/legacy"),
);

// Vue サブアプリを登録
registerApplication(
  "orders",
  () => System.import("http://localhost:8081/orders-app.js"),
  (location) => location.pathname.startsWith("/orders"),
);

start();
```

## Vue サブアプリのアダプター

```javascript
// orders-app/src/main.js
let vueInstance = null;

export async function bootstrap() {
  console.log("orders app bootstrapped");
}

export async function mount(props) {
  const { container, userInfo } = props;
  vueInstance = new Vue({
    router,
    render: (h) => h(App, { props: { userInfo } }),
  }).$mount(container || "#orders-container");
}

export async function unmount() {
  vueInstance.$destroy();
  vueInstance.$el.innerHTML = "";
  vueInstance = null;
}
```

## サブアプリ間通信

```javascript
// グローバルイベントバス
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  emit(event, data) {
    this.events[event]?.forEach((cb) => cb(data));
  }

  off(event, callback) {
    this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
  }
}

window.__MICRO_APP_BUS__ = new EventBus();

// サブアプリでの使用
window.__MICRO_APP_BUS__.emit("user:logout", {});
window.__MICRO_APP_BUS__.on("theme:change", (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
});
```

## ハマったポイント

1. **グローバル変数の汚染**：サブアプリのアンマウント時に登録したグローバル変数やイベントリスナーをクリーンアップする必要がある
2. **CSS のグローバル汚染**：サードパーティUIライブラリ（Element UI）のグローバルスタイルが互いに影響し合う
3. **ルーティングの競合**：サブアプリのルーターに `base` 設定が必要で、メインアプリと衝突しないようにする
4. **依存関係の重複**：各サブアプリが Vue を個別にバンドルするとサイズが増大。CDN 共有で対処できる

## まとめ

- マイクロフロントエンドは「大型レガシーシステムの段階的移行」や「複数チームの並行開発」に適している
- single-spa のコアはサブアプリの登録とライフサイクル（bootstrap/mount/unmount）
- スタイル分離には CSS Modules が推奨。サブアプリ間通信はグローバルイベントバスを使用
- よくある落とし穴：グローバル変数汚染、CSS 汚染、ルーティング競合
