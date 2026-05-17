---
title: "デバウンスとスロットル：原理・実装・ユースケース"
date: 2018-04-17 16:15:36
tags:
  - フロントエンド
readingTime: 4
description: "デバウンスとスロットルはフロントエンド最適化の基本ツールで、ほぼすべてのプロジェクトで使われ、面接でも必ず問われます。この記事では両者の違いと適切な使いどころを説明します。"
---

デバウンスとスロットルはフロントエンド最適化の基本ツールで、ほぼすべてのプロジェクトで使われ、面接でも必ず問われます。この記事では両者の違いと適切な使いどころを説明します。

## 背景

一部のイベントは非常に高頻度で発火します：

- `scroll`：スクロールのたびに数十回発火することも
- `resize`：ウィンドウサイズ変更時に連続して発火
- `input`：キーを押すたびに 1 回発火
- `mousemove`：マウス移動中は毎フレーム発火

毎回コールバックを実行すると（特にネットワークリクエストや DOM 操作を含む場合）、パフォーマンスが低下します。

## スロットル（Throttle）

**定義**：指定した時間内に何回発火しても、コールバックは 1 回だけ実行される。

**例え話**：流量制限された蛇口 — どれだけ大きく開けても 1 分に 1 滴しか出ない。

```javascript
function throttle(fn, delay) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();

    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// 使用例：スクロールイベントを最大 200ms に 1 回に制限
window.addEventListener(
  "scroll",
  throttle(() => {
    console.log("scroll position:", window.scrollY);
  }, 200),
);
```

**タイムスタンプ版**はインターバルの開始時に実行します（最後のトリガーを待たない）。

**タイマー版**（インターバルの終了時に実行）：

```javascript
function throttle(fn, delay) {
  let timer = null;

  return function (...args) {
    if (timer) return; // まだ待機中、無視する

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

**ユースケース：**

- スクロール読み込み（300ms ごとに底部到達を確認）
- ボタン連打防止（3 秒以内に 1 回だけ）
- マウス追従アニメーション
- API ポーリング頻度制御

## デバウンス（Debounce）

**定義**：イベントの発火が止まった後、指定時間待ってからコールバックを実行する。待機中に再び発火すると、タイマーをリセットする。

**例え話**：エレベーターのドア — 誰かが入ってきたら待ち直し、しばらく誰も入ってこなければ閉まる。

```javascript
function debounce(fn, delay) {
  let timer = null;

  return function (...args) {
    // 前のタイマーをクリア
    if (timer) clearTimeout(timer);

    // タイマーをリセット
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// 使用例：入力が 500ms 止まってから検索
const searchInput = document.getElementById("search");
searchInput.addEventListener(
  "input",
  debounce((e) => {
    fetchSearchResults(e.target.value);
  }, 500),
);
```

**即時実行版**（最初のトリガーで即実行し、その後クールダウン）：

```javascript
function debounce(fn, delay, immediate = false) {
  let timer = null;

  return function (...args) {
    const callNow = immediate && !timer;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);

    if (callNow) fn.apply(this, args);
  };
}
```

**ユースケース：**

- リアルタイム検索（入力停止後にリクエスト）
- フォームバリデーション（入力停止後に検証）
- ウィンドウリサイズ終了後にレイアウト再計算
- エディターのコンテンツ変更後の自動保存

## 比較

|                | スロットル           | デバウンス               |
| -------------- | -------------------- | ------------------------ |
| 実行タイミング | 一定間隔で実行       | イベント停止後に実行     |
| 適用場面       | 継続的な応答が必要   | 操作の完了を待つ         |
| 例             | スクロール位置の更新 | 検索ボックスのサジェスト |

**核心の違い**：スロットルは実行**頻度**を制御し、デバウンスは**操作の完了**を待ちます。

## Vue での使い方

```vue
<script>
import { debounce, throttle } from "lodash";

export default {
  data() {
    return { searchQuery: "" };
  },
  created() {
    // created で作成することで、各インスタンスが独立した debounce 関数を持つ
    this.debouncedSearch = debounce(this.fetchResults, 500);
  },
  beforeDestroy() {
    // コンポーネント破棄時に保留中の呼び出しをキャンセル
    this.debouncedSearch.cancel();
  },
  methods: {
    onInput(value) {
      this.searchQuery = value;
      this.debouncedSearch(value);
    },
    async fetchResults(query) {
      const results = await searchAPI(query);
      this.results = results;
    },
  },
};
</script>
```

**注意**：`methods` に直接 `debounce()` でラップすると、すべてのコンポーネントインスタンスが同じ debounce 関数を共有してしまいます：

```javascript
// ❌ 間違い：methods の関数はインスタンス間で共有される
methods: {
  onInput: debounce(function(value) { ... }, 500)
}

// ✅ 正しい：created で作成し、各インスタンスが独立
created() {
  this.debouncedFn = debounce(this.fn, 500)
}
```

## まとめ

- 高頻度イベントには必ずスロットルかデバウンスを適用する
- スロットル = 一定頻度で実行（継続的な応答が必要な場面）
- デバウンス = 停止後に実行（操作の完了を待つ場面）
- Vue では `created` で作成し、`beforeDestroy` でキャンセルする
