---
title: "CSS Houdini Paint API カスタム描画実践"
date: 2026-06-30 13:18:00
tags:
  - CSS
readingTime: 2
description: "CSS Houdini Paint API は開発者が JavaScript を使ってカスタム CSS 描画関数を定義できるようにし、従来の CSS では実現不可能な効果を実現する。Paint API の動作原理、実際の用法、パフォーマンス最適化を議論する。"
wordCount: 296
---

CSS Houdini Paint API は Web プラットフォームの大きな拡張だ。開発者が JavaScript を使ってカスタム CSS 描画関数を定義でき、従来の CSS の能力制限を突破する。

## Paint API の基礎

Paint API のコアは `PaintWorklet`：

```javascript
// paint-worklet.js
class GradientBackground {
  static get inputProperties() {
    return ['--gradient-colors', '--gradient-angle'];
  }

  paint(ctx, size, props) {
    const colors = props.get('--gradient-colors').toString().split(',');
    const angle = parseInt(props.get('--gradient-angle')) || 0;
    
    const radians = (angle - 90) * Math.PI / 180;
    const x = Math.cos(radians);
    const y = Math.sin(radians);
    
    const gradient = ctx.createLinearGradient(
      size.width / 2 - x * size.width / 2,
      size.height / 2 - y * size.height / 2,
      size.width / 2 + x * size.width / 2,
      size.height / 2 + y * size.height / 2
    );
    
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color.trim());
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

registerPaint('gradientBackground', GradientBackground);
```

```css
/* CSS で使用 */
.box {
  --gradient-colors: #ff6b6b, #4ecdc4, #45b7d1;
  --gradient-angle: 135deg;
  background: paint(gradientBackground);
}
```

## 実際のケース

**ケース 1：波パターン背景**

```javascript
class WavePattern {
  static get inputProperties() {
    return ['--wave-color', '--wave-amplitude', '--wave-frequency'];
  }

  paint(ctx, size, props) {
    const color = props.get('--wave-color').toString();
    const amplitude = parseFloat(props.get('--wave-amplitude')) || 20;
    const frequency = parseFloat(props.get('--wave-frequency')) || 3;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size.height);
    
    for (let x = 0; x <= size.width; x++) {
      const y = size.height / 2 + 
        Math.sin(x / size.width * Math.PI * 2 * frequency) * amplitude;
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(size.width, size.height);
    ctx.closePath();
    ctx.fill();
  }
}

registerPaint('wavePattern', WavePattern);
```

## パフォーマンス最適化

**最適化 1：計算結果をキャッシュ**

**最適化 2：Canvas 操作を削減**

```javascript
// 悪い例：複数回の fillRect 呼び出し
for (let i = 0; i < 1000; i++) {
  ctx.fillRect(x, y, 10, 10);
}

// 良い例：バッチ操作
ctx.beginPath();
for (let i = 0; i < 1000; i++) {
  ctx.rect(x, y, 10, 10);
}
ctx.fill();
```

## ブラウザサポート

| ブラウザ | バージョン | 状態 |
|----------|------------|------|
| Chrome | 65+ | 完全サポート |
| Edge | 79+ | 完全サポート |
| Firefox | 101+ | 完全サポート |
| Safari | 16.4+ | 完全サポート |

## まとめ

CSS Houdini Paint API は開発者が JavaScript を使ってカスタム CSS 描画関数を定義できるようにする。従来の CSS の能力制限を突破し、動的背景、装飾パターンなどの効果を実現する。2026 年の Paint API は成熟しており、ブラウザサポートも良好、本番環境に使用するのに十分なパフォーマンスを備えている。
