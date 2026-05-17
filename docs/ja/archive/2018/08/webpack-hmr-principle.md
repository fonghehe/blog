---
title: "Webpack HMRホットモジュール置換の原理"
date: 2018-08-25 09:35:16
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "開発中にコードを変更するとページが自動更新される、これがHMR（Hot Module Replacement）です。当たり前のように使っていますが、今日その原理を調べてみました。"
---

開発中にコードを変更するとページが自動更新される、これがHMR（Hot Module Replacement）です。当たり前のように使っていますが、今日その原理を調べてみました。

## HMRの全体的な流れ

```
1. Webpackがファイル変更を監視（watchモード）
2. ファイル変更 → 変更されたモジュールを再コンパイル
3. コンパイル完了 → WebSocketでブラウザに通知（hashを送信）
4. ブラウザが通知を受け取る → devサーバーに更新されたモジュールをリクエスト（manifest + chunk）
5. ブラウザが新モジュールを受け取る → HMR Runtimeが古いモジュールを置換
6. 置換成功 → 部分更新、ページリロードなし
7. 置換失敗 → ページ全体を強制リロード（フォールバック）
```

## webpack-dev-serverの役割

```javascript
// webpack-dev-serverは2つのことをします：
// 1. HTTPサーバーを起動（静的リソースを提供）
// 2. WebSocketサーバーを起動（更新通知をプッシュ）

// ブラウザに注入されたHMRクライアントコード（bundleに含まれる）
// WebSocket接続を確立し、webpackのコンパイルイベントをリッスン
const socket = new WebSocket("ws://localhost:8080");
socket.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  if (type === "hash") {
    currentHash = data; // 最新のhashを記録
  }
  if (type === "ok") {
    // コンパイル完了、更新をリクエスト
    checkForUpdates();
  }
};
```

## モジュール置換の実装

```javascript
// webpackでコンパイルされたモジュールはすべて__webpack_modules__オブジェクトに登録される
// HMR Runtimeの置換はこのオブジェクト内の対応する関数を更新すること

// foo.jsが変更されたとする：
__webpack_modules__["./src/foo.js"] = function (module, exports) {
  // ここに新しいfoo.jsのコードが入る
};

// そしてfoo.jsに依存するモジュールに再実行を通知
// hot.acceptを処理するモジュールがあれば部分更新
// なければバブルアップして、処理するモジュールが見つかるか全ページリロードが発生
```

## module.hot.accept：部分的なホット置換

```javascript
// モジュール自身の更新を受け入れることを宣言
if (module.hot) {
  module.hot.accept("./utils", () => {
    // utils.jsが更新された後、このコールバックが呼ばれる
    const newUtils = require("./utils");
    updateUI(newUtils);
  });
}
```

VueとReactのHMRが「自動的に」動くのは、vue-loaderとreact-refreshが自動的に`module.hot.accept`ロジックを注入しているからです。

## vue-loaderがHMRを処理する方法

```javascript
// vue-loaderのコンパイル後、大まかにこのようなコードが注入される：
if (module.hot) {
  module.hot.accept(); // 自身の更新を受け入れる

  if (!isFirstRender) {
    // 新しいコンポーネントオプションで古いものを置換
    const newOptions = require("./MyComponent.vue");
    component.options = newOptions;

    // 強制再レンダリング
    component.__vue_hot__ = Date.now();
  }
}
```

## 状態を保持するHMR

VueのHMRはコンポーネントの状態（data）を保持し、テンプレートとメソッドのみを更新します。

```javascript
// MyComponent.vueのtemplateを変更
// HMR後：dataの値は変わらず、ビューのみ更新

// ❌ ただしこれらの場合は状態がリセットされる（やむを得ない）：
// - dataの初期値を変更した場合
// - created/mountedフックを変更した場合
```

## CSSのHMR

CSSはシンプルで、style-loaderが直接`<style>`タグを置換します：

```javascript
// style-loaderが注入するHMRコード
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // 古いstyleタグを削除
    styleElement.remove();
  });
  // 新しいstyleタグを追加
}
```

## まとめ

- HMRはWebSocketで更新通知をプッシュし、HTTPで新しいモジュールを取得
- モジュール置換は`__webpack_modules__`内の対応する関数を更新すること
- `module.hot.accept`でホット更新の受け入れを宣言、vue-loader/react-refreshが自動注入
- CSSのホット更新はstyleタグを直接置換、状態の問題なし
- 置換失敗時はフォールバックとしてページ全体をリロード
