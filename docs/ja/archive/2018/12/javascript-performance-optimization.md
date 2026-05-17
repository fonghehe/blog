---
title: "フロントエンドパフォーマンス最適化：JS 実行パフォーマンス編"
date: 2018-12-15 10:33:56
tags:
  - パフォーマンス最適化
readingTime: 2
description: "先月、ページのカクつき問題を調査したところ、JS の実行時間が長すぎてフレームドロップが発生していることがわかりました。この機会に JS パフォーマンス最適化の定石をまとめます。"
---

先月、ページのカクつき問題を調査したところ、JS の実行時間が長すぎてフレームドロップが発生していることがわかりました。この機会に JS パフォーマンス最適化の定石をまとめます。

## ブラウザのフレームレート

滑らかなアニメーションは 60fps、つまり1フレームあたり約 16.7ms です。

```
1フレームの時間（16.7ms）でやるべきこと：
- JS 実行
- スタイル計算
- レイアウト
- 描画
- 合成

JS 実行が 16ms を超えると、そのフレームが遅延し、ユーザーにカクつきとして感じられる
```

## 長いタスクの分割

```javascript
// ❌ 10000件のデータを処理してメインスレッドをブロック
function processLargeList(list) {
  list.forEach((item) => {
    // 重い処理
    processItem(item);
  });
}

// ✅ 方法1：バッチ処理
function processInBatches(list, batchSize = 100) {
  let index = 0;

  function processBatch() {
    const end = Math.min(index + batchSize, list.length);
    while (index < end) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      // バッチ処理が終わったら、メインスレッドに処理を戻す。ブラウザがユーザー入力に応答できる
      requestAnimationFrame(processBatch);
    }
  }

  requestAnimationFrame(processBatch);
}

// ✅ 方法2：requestIdleCallback を使う（ブラウザのアイドル時に処理）
function processWhenIdle(list) {
  let index = 0;

  requestIdleCallback(function process(deadline) {
    // deadline.timeRemaining()：このフレームに残り時間がどれくらいあるか
    while (deadline.timeRemaining() > 0 && index < list.length) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      requestIdleCallback(process);
    }
  });
}
```

## デバウンスとスロットル

```javascript
// デバウンス：操作が止まってから delay ミリ秒後に実行（検索サジェスト）
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// スロットル：interval ミリ秒に最大1回実行（スクロール処理）
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// 実際の使用
const debouncedSearch = debounce(handleSearch, 300);
const throttledScroll = throttle(handleScroll, 100);

input.addEventListener("input", debouncedSearch);
window.addEventListener("scroll", throttledScroll);
```

## 頻繁な DOM 操作を避ける

```javascript
// ❌ ループのたびに DOM をクエリしてリフロー（強制レイアウト）を発生させる
for (let i = 0; i < 100; i++) {
  const height = element.offsetHeight; // 読み取りで強制同期レイアウトが発生
  element.style.top = height * i + "px"; // 書き込み
}

// ✅ 読み取りと書き込みを分離する
const height = element.offsetHeight; // 一度だけ読み取る
for (let i = 0; i < 100; i++) {
  elements[i].style.top = height * i + "px"; // 書き込みのみ
}

// ✅ DocumentFragment で一括挿入
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement("li");
  li.textContent = `Item ${i}`;
  fragment.appendChild(li); // リフロー発生なし
}
ul.appendChild(fragment); // 一度だけ挿入。リフローは1回のみ
```

## Web Worker：重い計算をバックグラウンドへ

```javascript
// worker.js
self.addEventListener("message", (e) => {
  const { data } = e;
  const result = heavyCompute(data); // ワーカースレッドで実行
  self.postMessage(result);
});

// main.js
const worker = new Worker("/worker.js");

worker.postMessage(largeData);
worker.addEventListener("message", (e) => {
  displayResult(e.data); // 結果が返ってきたら UI を更新
});
```

## メモリと GC プレッシャー

```javascript
// ❌ ホットパスで頻繁にオブジェクトを作成して GC プレッシャーを増大させる
function updateItems(items) {
  return items.map((item) => ({
    // 毎回新しいオブジェクトを作成
    ...item,
    display: formatDisplay(item),
  }));
}

// ✅ オブジェクトを再利用する（パフォーマンスのクリティカルパスで）
function updateItems(items, result) {
  for (let i = 0; i < items.length; i++) {
    result[i] = result[i] || {}; // 既存のオブジェクトを再利用
    Object.assign(result[i], items[i]);
    result[i].display = formatDisplay(items[i]);
  }
}
```

## Performance API で計測する

```javascript
performance.mark("start-heavy");
heavyOperation();
performance.mark("end-heavy");
performance.measure("heavy", "start-heavy", "end-heavy");

const [measure] = performance.getEntriesByName("heavy");
console.log(`処理時間: ${measure.duration.toFixed(2)}ms`);
```

## まとめ

- 長いタスクはバッチ処理（`requestAnimationFrame` または `requestIdleCallback`）
- scroll/resize イベントはスロットル、input 検索はデバウンス
- DOM の読み取りと書き込みを分離。交互に行うと強制同期レイアウトが発生する
- 重い計算は Web Worker でメインスレッドから移す
- `performance.mark/measure` でクリティカルパスの処理時間を正確に計測する
