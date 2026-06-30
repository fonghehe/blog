---
title: "CSS Houdini Paint API 自訂繪製實踐"
date: 2026-06-30 13:18:00
tags:
  - CSS
readingTime: 1
description: "CSS Houdini Paint API 讓開發者可以用 JavaScript 自訂 CSS 繪製函數，實現傳統 CSS 無法實現的效果。本文討論 Paint API 的工作原理、實際用法和效能最佳化。"
wordCount: 205
---

CSS Houdini Paint API 是 Web 平台的一次重大擴展。它允許開發者用 JavaScript 定義自訂的 CSS 繪製函數，突破了傳統 CSS 的能力限制。

## Paint API 基礎

Paint API 的核心是 `PaintWorklet`：

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
/* CSS 中使用 */
.box {
  --gradient-colors: #ff6b6b, #4ecdc4, #45b7d1;
  --gradient-angle: 135deg;
  background: paint(gradientBackground);
}
```

## 實際案例

**案例 1：波浪背景**

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

## 效能最佳化

**最佳化 1：快取計算結果**

**最佳化 2：減少 Canvas 操作**

```javascript
// 不好的做法：多次呼叫 fillRect
for (let i = 0; i < 1000; i++) {
  ctx.fillRect(x, y, 10, 10);
}

// 好的做法：批次操作
ctx.beginPath();
for (let i = 0; i < 1000; i++) {
  ctx.rect(x, y, 10, 10);
}
ctx.fill();
```

## 瀏覽器支援

| 瀏覽器 | 版本 | 狀態 |
|--------|------|------|
| Chrome | 65+ | 完全支援 |
| Edge | 79+ | 完全支援 |
| Firefox | 101+ | 完全支援 |
| Safari | 16.4+ | 完全支援 |

## 小結

CSS Houdini Paint API 讓開發者可以用 JavaScript 自訂 CSS 繪製函數。它突破了傳統 CSS 的能力限制，實現了動態背景、裝飾圖案等效果。2026 年的 Paint API 已經成熟，瀏覽器支援良好，效能也足夠用於生產環境。
