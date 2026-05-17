---
title: "CSSアニメーションのパフォーマンス最適化：原理から実践まで"
date: 2019-06-06 16:37:34
tags:
  - CSS
readingTime: 2
description: "フロントエンドのアニメーションをたくさん作ると気づくことがあります——アニメーションを書けないのではなく、アニメーションが増えると動作が重くなるということです。特にモバイルでは、60fpsのスムーズなアニメーションはユーザーエクスペリエンスの基本です。本記事はブラウザのレンダリング原理から出発し、CSSアニメーションが"
---

フロントエンドのアニメーションをたくさん作ると気づくことがあります——アニメーションを書けないのではなく、アニメーションが増えると動作が重くなるということです。特にモバイルでは、60fpsのスムーズなアニメーションはユーザーエクスペリエンスの基本です。本記事はブラウザのレンダリング原理から出発し、CSSアニメーションがどこで遅くなるのか、そして最適化方法を解説します。

## ブラウザのレンダリングパイプライン

アニメーションのパフォーマンスを最適化するには、まずブラウザが1フレームをレンダリングする流れを理解する必要があります：

```
JavaScript → Style → Layout → Paint → Composite
```

各フェーズでやること：

- **Style**：要素の最終的なCSSスタイルを計算
- **Layout**（リフロー）：要素のジオメトリ——位置・幅・高さを計算
- **Paint**（再描画）：ピクセルを塗る——色・ボーダー・シャドウ・テキストなど
- **Composite**（合成）：複数のレイヤーを最終的なページに合成

重要な認識：**後のフェーズほど、プロパティ変更のパフォーマンスコストが低い**。Compositeフェーズで処理されるプロパティはLayoutとPaintをトリガーしません。

## どのCSSプロパティがどのフェーズをトリガーするか

```css
/* Compositeのみ（最良） */
.animated-gpu {
  /*
   * transformとopacityは最も安全なアニメーションプロパティです。
   * GPUが直接処理でき、レイアウトや再描画をトリガーしません。
   */
  transform: translateX(100px);
  transform: rotate(45deg);
  transform: scale(1.5);
  opacity: 0.5;
}

/* Paint + Composite（中程度のコスト） */
.animated-paint {
  /*
   * これらのプロパティはジオメトリを変更しない（リフロー不要）が、
   * ピクセルの再描画が必要です。
   */
  color: red;
  background: blue;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Layout + Paint + Composite（最もコストが高い——アニメーションでは避ける） */
.animated-layout {
  /*
   * これらのプロパティは要素のジオメトリを変更し、
   * ブラウザにレイアウトの再計算（リフロー）を強制させます。
   */
  width: 200px;
  height: 100px;
  margin: 10px;
  padding: 20px;
  top: 50px;
  left: 50px;
  font-size: 16px;
}
```

コア原則を一言で：**アニメーションには`transform`と`opacity`だけを使う**。

## GPUアクセラレーション

```css
/* 独自のコンポジターレイヤーに昇格 */
.will-animate {
  will-change: transform, opacity;
  /* または古いハック: transform: translateZ(0); */
}
```

## 実践例：スライドインカード

```css
/* ❌ top/leftでアニメーション（Layoutをトリガー） */
.card-bad {
  position: absolute;
  top: -100px;
  transition: top 0.3s ease;
}
.card-bad.active {
  top: 0;
}

/* ✅ transformでアニメーション（Compositeのみ） */
.card-good {
  transform: translateY(-100px);
  transition: transform 0.3s ease;
}
.card-good.active {
  transform: translateY(0);
}
```

最適化前に必ずDevToolsのPerformanceパネルでプロファイリングしましょう——まず計測して、実際のボトルネックを最適化します。
