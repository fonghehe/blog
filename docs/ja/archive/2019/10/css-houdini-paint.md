---
title: "CSS Houdini Paint API の探索"
date: 2019-10-03 15:32:59
tags:
  - CSS
readingTime: 6
description: "CSS Houdini 是 W3C 提出的一组底层 CSS API，它让开发者可以直接接入 CSS 渲染引擎的各个阶段。其中 Paint API 是目前浏览器支持度最好的一个，它允许我们用 JavaScript 绘制自定义的 CSS 图案，替代传统的背景图方案。"
wordCount: 1126
---

CSS Houdini は W3C が提案した一連の低レベル CSS API であり、開発者が CSS レンダリングエンジンの各段階に直接介入できるようにします。中でも Paint API は現在ブラウザでの対応が最も進んでおり、JavaScript を用いて独自の CSS パターンを描画し、従来の背景画像を置き換えることができます。

## CSS Paint APIとは何か

従来、複雑な背景エフェクト（グラデーションの格子模様、波線、動的な斑点など）を実現するには、CSS のグラデーションを組み合わせるか、画像を使うか、SVG を使うかのいずれかでした。CSS Paint API は第 4 のアプローチを提供します。JavaScript で描画ロジックを記述し、あたかも CSS の関数のように直接呼び出せるようになるのです。

```css
/* 传统方式 */
.box {
  background: url('dots.png') repeat;
}

/* Paint API 方式 */
.box {
  background: paint(dots);
}
```

中心的な概念は以下のとおりです：

- **Worklet**：独立したスレッドで動作する軽量な JS モジュール
- **registerPaint()**：描画ハンドラを登録する
- **paint()**：実際の描画コールバック関数

## ブラウザサポートと検出

現時点では、Chrome 65 以降で Paint API が完全にサポートされており、Chromium ベースの Edge でも利用できます。Firefox と Safari はまだデフォルトでは有効になっていません。

```js
// 检测浏览器支持
if ('paintWorklet' in CSS) {
  console.log('CSS Paint API 可用');
} else {
  console.log('需要 polyfill 或降级方案');
}
```

互換性のために [css-paint-polyfill](https://github.com/GoogleChromeLabs/css-paint-polyfill) を利用できます：

```html
<script src="https://unpkg.com/css-paint-polyfill"></script>
```

## 最初のPaint Workletを登録する

独立した JS ファイルを Worklet として作成し、その中で `registerPaint` を使って描画器を登録します。Worklet 内で使用できる描画 API は、Canvas 2D API のサブセットです：

```js
// worklets/dots.js
class DotsPainter {
  // 声明此绘制器依赖的 CSS 属性
  static get inputProperties() {
    return [
      '--dot-color',
      '--dot-size',
      '--dot-spacing'
    ];
  }

  // 绘制回调
  paint(ctx, size, properties) {
    const dotColor = properties.get('--dot-color').toString().trim() || '#3498db';
    const dotSize = parseFloat(properties.get('--dot-size').toString()) || 4;
    const spacing = parseFloat(properties.get('--dot-spacing').toString()) || 20;

    ctx.fillStyle = dotColor;

    for (let x = 0; x < size.width; x += spacing) {
      for (let y = 0; y < size.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x + spacing / 2, y + spacing / 2, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

registerPaint('dots', DotsPainter);
```

ページに Worklet を読み込みます：

```js
// 主线程中注册
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('/worklets/dots.js');
}
```

これで CSS から利用できるようになります：

```css
.dot-box {
  --dot-color: #e74c3c;
  --dot-size: 3;
  --dot-spacing: 24;
  background: paint(dots);
  width: 400px;
  height: 300px;
}
```

## inputPropertiesでCSS変数に反応する

Paint API の最も強力な点は、CSS カスタムプロパティ（CSS Variables）を読み取れることです。つまり、描画の振る舞いを CSS だけで完全に制御できるようになります：

```js
class GradientWavePainter {
  static get inputProperties() {
    return [
      '--wave-color',
      '--wave-amplitude',
      '--wave-frequency',
      '--wave-offset'
    ];
  }

  paint(ctx, size, properties) {
    const color = properties.get('--wave-color').toString().trim() || '#667eea';
    const amplitude = parseFloat(properties.get('--wave-amplitude').toString()) || 30;
    const frequency = parseFloat(properties.get('--wave-frequency').toString()) || 0.02;
    const offset = parseFloat(properties.get('--wave-offset').toString()) || 0;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size.height);

    for (let x = 0; x <= size.width; x++) {
      const y = size.height / 2 + Math.sin((x * frequency) + offset) * amplitude;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(size.width, size.height);
    ctx.closePath();
    ctx.fill();
  }
}

registerPaint('wave', GradientWavePainter);
```

CSS の部分は以下のようになります：

```css
.wave-section {
  --wave-color: rgba(102, 126, 234, 0.5);
  --wave-amplitude: 40;
  --wave-frequency: 0.015;
  --wave-offset: 0;
  background: paint(wave);
}
```

## 実践：カスタム枠線描画器

よくある要望の一つが、ジグザグのようなカスタム枠線スタイルです：

```js
class ZigzagPainter {
  static get inputProperties() {
    return [
      '--zigzag-color',
      '--zigzag-size'
    ];
  }

  paint(ctx, size, properties) {
    const color = properties.get('--zigzag-color').toString().trim() || '#333';
    const zigSize = parseFloat(properties.get('--zigzag-size').toString()) || 10;

    ctx.fillStyle = color;

    // 顶部锯齿
    for (let x = 0; x < size.width; x += zigSize * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + zigSize, zigSize);
      ctx.lineTo(x + zigSize * 2, 0);
      ctx.fill();
    }

    // 底部锯齿
    for (let x = 0; x < size.width; x += zigSize * 2) {
      ctx.beginPath();
      ctx.moveTo(x, size.height);
      ctx.lineTo(x + zigSize, size.height - zigSize);
      ctx.lineTo(x + zigSize * 2, size.height);
      ctx.fill();
    }
  }
}

registerPaint('zigzag', ZigzagPainter);
```

## アニメーション効果の実装

Worklet は独立したスレッドで動作しており、DOM に直接アクセスしたり `requestAnimationFrame` を使ったりすることはできません。アニメーションを行うには、メインスレッド側で CSS 変数を変更して再描画を引き起こす必要があります：

```js
// 主线程代码
function animateWave() {
  const el = document.querySelector('.wave-section');
  let offset = 0;

  function frame() {
    offset += 0.05;
    el.style.setProperty('--wave-offset', offset);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

animateWave();
```

## 実践：スケルトン読み込みプレースホルダー

```js
class SkeletonPainter {
  static get inputProperties() {
    return [
      '--skeleton-base-color',
      '--skeleton-shine-color',
      '--skeleton-progress'
    ];
  }

  paint(ctx, size, properties) {
    const baseColor = properties.get('--skeleton-base-color').toString().trim() || '#e0e0e0';
    const shineColor = properties.get('--skeleton-shine-color').toString().trim() || '#f5f5f5';
    const progress = parseFloat(properties.get('--skeleton-progress').toString()) || 0;

    // 底色
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size.width, size.height);

    // 闪光扫过效果
    const shineX = (size.width + 200) * progress - 100;
    const gradient = ctx.createLinearGradient(shineX, 0, shineX + 200, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, shineColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

registerPaint('skeleton', SkeletonPainter);
```

メインスレッドのアニメーションと組み合わせます：

```js
CSS.paintWorklet.addModule('/worklets/skeleton.js');

function startSkeletonAnimation() {
  const el = document.querySelector('.skeleton-box');
  let progress = 0;

  function frame() {
    progress = (progress + 0.005) % 1;
    el.style.setProperty('--skeleton-progress', progress);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
```

## Canvasとの比較

| 特性 | Paint API | Canvas |
|------|-----------|--------|
| 実行スレッド | Worklet スレッド | メインスレッド |
| CSS との統合 | CSS に自然に統合され、background として直接利用可能 | 手動での設定が必要 |
| レスポンシブ | 要素のサイズ変化に自動追従 | resize の手動監視が必要 |
| DOM アクセス | 不可 | 可 |
| イベント処理 | 非対応 | 対応 |

## まとめ

- CSS Paint API は Houdini 仕様の中で最も成熟したモジュールであり、Chrome ですでに完全サポートされている
- `registerPaint()` で描画器を登録し、Canvas 2D のサブセット API で描画する
- `inputProperties` で CSS カスタムプロパティを読み取り、宣言的な制御を実現できる
- Worklet は独立したスレッドで動作するため、メインスレッドをブロックしない
- 背景パターン、枠線装飾、プレースホルダーなどの純粋な視覚効果に適している
- アニメーションはメインスレッドで CSS 変数を変更して再描画をトリガーする必要がある
- css-paint-polyfill を使ってフォールバック互換に対応できる
