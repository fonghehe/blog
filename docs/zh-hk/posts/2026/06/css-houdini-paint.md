---
title: "CSS Houdini Paint API 自定義繪製實踐"
date: 2026-06-30 13:18:00
tags:
  - CSS
readingTime: 1
description: "CSS Houdini Paint API 讓開發者可以用 JavaScript 自定義 CSS 繪製函數，實現傳統 CSS 無法實現的效果。本文討論 Paint API 的工作原理、實際用法和性能優化。"
wordCount: 193
---

CSS Houdini Paint API 是 Web 平台的一次重大擴展。它允許開發者用 JavaScript 定義自定義的 CSS 繪製函數，突破了傳統 CSS 的能力限制。

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

## 性能優化

**優化 1：緩存計算結果**

**優化 2：減少 Canvas 操作**

```javascript
// 不好的做法：多次調用 fillRect
for (let i = 0; i < 1000; i++) {
  ctx.fillRect(x, y, 10, 10);
}

// 好的做法：批量操作
ctx.beginPath();
for (let i = 0; i < 1000; i++) {
  ctx.rect(x, y, 10, 10);
}
ctx.fill();
```

## 瀏覽器支持

| 瀏覽器 | 版本 | 狀態 |
|--------|------|------|
| Chrome | 65+ | 完全支持 |
| Edge | 79+ | 完全支持 |
| Firefox | 101+ | 完全支持 |
| Safari | 16.4+ | 完全支持 |

## 總結

CSS Houdini Paint API 讓開發者可以用 JavaScript 自定義 CSS 繪製函數。它突破了傳統 CSS 的能力限制，實現了動態背景、裝飾圖案等效果。2026 年的 Paint API 已經成熟，瀏覽器支持良好，性能也足夠用於生產環境。
