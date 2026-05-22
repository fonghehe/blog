---
title: "CSS 动画パフォーマンス最適化：从原理到実践（2018 版）"
date: 2019-06-06 16:37:34
tags:
  - CSS
readingTime: 2
description: "CSS アニメーションはよく使われますが、書き方が悪いとカクついたり電池を消耗させたりします。アニメーション最適化の前に、ブラウザのレンダリングパイプラインを理解することが必要です。"
wordCount: 550
---

CSS アニメーションはよく使われますが、書き方が悪いとカクついたり電池を消耗させたりします。アニメーション最適化の前に、ブラウザのレンダリングパイプラインを理解することが必要です。

## ブラウザのレンダリングパイプライン

```
Style → Layout → Paint → Composite
```

- **Style**：どの CSS ルールが適用されるかを計算
- **Layout（リフロー）**：幾何学（位置、サイズ）を計算
- **Paint**：ピクセルを塗りつぶす（色、背景、影）
- **Composite**：レイヤーをマージして画面に表示

Layout または Paint ステージのプロパティを変更するアニメーションは、毎フレーム高コストの処理をやり直します。`transform` と `opacity` だけが **Composite** ステージで完全に処理されます。

## プロパティがどのステージを引き起こすか

| プロパティ            | Layout | Paint | Composite |
| --------------------- | ------ | ----- | --------- |
| width, height, margin | ✅     | ✅    | ✅        |
| background, color     | ❌     | ✅    | ✅        |
| transform             | ❌     | ❌    | ✅        |
| opacity               | ❌     | ❌    | ✅        |

アニメーションには可能な限り `transform` と `opacity` を使いましょう。

## left/top を transform に置き換える

```css
/* 悪い例：毎フレームでレイアウト + ペイントを引き起こす */
@keyframes move-bad {
  from {
    left: 0;
  }
  to {
    left: 300px;
  }
}

/* 良い例：コンポジットのみ */
@keyframes move-good {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(300px);
  }
}
```

視覚的な結果は同じですが、`transform` バージョンは独立したコンポジットレイヤーで GPU 上で実行されます。

## will-change：正しい使い方

`will-change` はアニメーション開始前に要素を独自のコンポジットレイヤーに昇格させるようブラウザに指示します：

```css
.animated-menu {
  will-change: transform;
}
```

```javascript
/* アニメーション完了後に削除する */
element.addEventListener("animationend", () => {
  element.style.willChange = "auto";
});
```

**よくある間違い：**

```css
/* 間違い：すべてに追加しない */
* {
  will-change: transform; /* 何千ものコンポジットレイヤーを作成 */
}
```

`will-change` はアニメーション直前に適用し、完了後に削除すべきです。各コンポジットレイヤーは GPU メモリを消費します。

## 実践例：ドロップダウンメニュー

```css
.dropdown {
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.2s ease;
  will-change: transform;
}

.dropdown.open {
  transform: scaleY(1);
}
```

このドロップダウンアニメーションは `transform` のみを使用します。毎フレームでのレイアウトやペイントはなく、完全に GPU アクセラレートされます。
