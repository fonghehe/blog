---
title: "CSS アニメーションパフォーマンス：transform と opacity"
date: 2018-10-03 11:29:08
tags:
  - CSS
readingTime: 2
description: "スライドインアニメーションを実装したところ、モバイルで明らかなカクつきが発生しました。調査すると `margin`/`top` でアニメーションしていたことが判明し、`transform` に変更したところ滑らかになりました。"
---

スライドインアニメーションを実装したところ、モバイルで明らかなカクつきが発生しました。調査すると `margin`/`top` でアニメーションしていたことが判明し、`transform` に変更したところ滑らかになりました。

## なぜ transform が速いのか

ブラウザのレンダリングパイプライン：

```
JavaScript → Style → Layout → Paint → Composite
（JS実行）  （スタイル計算）（レイアウト）（描画） （合成）
```

プロパティによってトリガーされる処理が異なります：

```
left/top/margin/width/height → Layout（リフロー）+ Paint + Composite をトリガー
  - 要素のジオメトリ情報を変更する
  - 関連するすべての要素の位置を再計算する必要がある
  - 最も遅い

background/color/visibility → Paint（リペイント）+ Composite をトリガー
  - ジオメトリは変わらないが、ピクセルを再描画する必要がある
  - 中程度

transform/opacity → Composite のみをトリガー
  - ドキュメントフローに影響を与えず、GPU が独立したレイヤーで処理する
  - 最も速い
```

## 実践的な比較

```css
/* ❌ 遅い：リフローをトリガー */
@keyframes slide-in-bad {
  from {
    left: -100px;
  }
  to {
    left: 0;
  }
}

/* ✅ 速い：合成のみ */
@keyframes slide-in-good {
  from {
    transform: translateX(-100px);
  }
  to {
    transform: translateX(0);
  }
}

/* ❌ 遅い：サイズ変更でリフローをトリガー */
@keyframes expand-bad {
  from {
    width: 100px;
    height: 100px;
  }
  to {
    width: 200px;
    height: 200px;
  }
}

/* ✅ 速い：scale を使用 */
@keyframes expand-good {
  from {
    transform: scale(0.5);
  }
  to {
    transform: scale(1);
  }
}
```

## will-change：ブラウザに事前準備を指示

```css
/* このエレメントがアニメーションすることをブラウザに伝え、事前に合成レイヤーを作成させる */
.animated-element {
  will-change: transform;
}

/* または translateZ(0) のハック（古い方法、非推奨）*/
.animated-element {
  transform: translateZ(0);
}
```

**注意**：`will-change` を乱用しないでください。各合成レイヤーは追加のメモリを消費します：

```css
/* ❌ 全要素に追加（それぞれが合成レイヤーを作成してメモリ不足に）*/
* {
  will-change: transform;
}

/* ✅ 本当にアニメーションが必要な要素にのみ追加し、アニメーション終了後に削除 */
.card:hover {
  will-change: transform;
}
```

## JavaScript で will-change を制御

```javascript
// より細かい制御：ホバー時に追加し、離れた時に削除
element.addEventListener("mouseenter", () => {
  element.style.willChange = "transform";
});
element.addEventListener("animationend", () => {
  element.style.willChange = "auto"; // リソースを解放
});
```

## デバッグツール

Chrome DevTools → Rendering パネル：

- **Paint flashing**：緑色のハイライトでリペイントされている領域を表示 — 面積が大きいほど遅い
- **Layer borders**：合成レイヤーの境界を表示してレイヤー数を把握できる
- **FPS meter**：リアルタイムフレームレート

## スムーズなアニメーションの実践

```css
/* 完全なスムーズなカードホバーエフェクト */
.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  will-change: transform;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

## まとめ

- アニメーションには `transform` と `opacity` を使用 — Composite ステージのみをトリガー
- `left`、`top`、`width`、`height` のアニメーションは避ける — コストの高い Layout + Paint をトリガー
- `will-change` は控えめに使用し、必要な時だけ追加して終了後に削除する
- DevTools の Rendering パネルでリペイントされている領域を確認する
