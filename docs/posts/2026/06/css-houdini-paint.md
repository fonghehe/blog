---
title: "CSS Houdini Paint API 自定义绘制实践"
date: 2026-06-30 13:18:00
tags:
  - CSS
readingTime: 3
description: "CSS Houdini Paint API 让开发者可以用 JavaScript 自定义 CSS 绘制函数，实现传统 CSS 无法实现的效果。本文讨论 Paint API 的工作原理、实际用法和性能优化。"
wordCount: 322
---

CSS Houdini Paint API 是 Web 平台的一次重大扩展。它允许开发者用 JavaScript 定义自定义的 CSS 绘制函数，突破了传统 CSS 的能力限制。

## Paint API 基础

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

## 注册 Paint Worklet

在 CSS 中注册 Worklet：

```css
/* 方式 1：使用 @property 注册 */
@property --gradient-colors {
  syntax: '<string>';
  inherits: false;
  initial-value: '#ff6b6b, #4ecdc4';
}

/* 方式 2：在 JavaScript 中注册 */
CSS.paintWorklet.addModule('paint-worklet.js');
```

## 实际案例

**案例 1：波浪背景**

```javascript
// wave.js
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

```css
.wave-bg {
  --wave-color: rgba(78, 205, 196, 0.3);
  --wave-amplitude: 30;
  --wave-frequency: 2;
  background: paint(wavePattern);
}
```

**案例 2：网格图案**

```javascript
// grid.js
class GridPattern {
  static get inputProperties() {
    return ['--grid-color', '--grid-size', '--grid-width'];
  }

  paint(ctx, size, props) {
    const color = props.get('--grid-color').toString();
    const gridSize = parseFloat(props.get('--grid-size')) || 20;
    const lineWidth = parseFloat(props.get('--grid-width')) || 1;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // 垂直线
    for (let x = 0; x <= size.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    
    // 水平线
    for (let y = 0; y <= size.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }
  }
}

registerPaint('gridPattern', GridPattern);
```

**案例 3：噪声纹理**

```javascript
// noise.js
class NoiseTexture {
  static get inputProperties() {
    return ['--noise-color', 'background-color'];
  }

  paint(ctx, size, props) {
    const color = props.get('--noise-color').toString();
    const bgColor = props.get('background-color').toString();
    
    // 填充背景色
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size.width, size.height);
    
    // 添加噪声
    const imageData = ctx.getImageData(0, 0, size.width, size.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 30 - 15;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
}

registerPaint('noiseTexture', NoiseTexture);
```

## 性能优化

Paint API 的性能需要注意：

**优化 1：缓存计算结果**

```javascript
class OptimizedPattern {
  static get inputProperties() {
    return ['--pattern-size'];
  }

  paint(ctx, size, props) {
    const patternSize = parseFloat(props.get('--pattern-size')) || 10;
    
    // 缓存重复计算
    const cache = new Map();
    
    for (let x = 0; x < size.width; x += patternSize) {
      for (let y = 0; y < size.height; y += patternSize) {
        const key = `${x},${y}`;
        if (!cache.has(key)) {
          cache.set(key, this.calculatePattern(x, y));
        }
        // 使用缓存
      }
    }
  }
}
```

**优化 2：减少 Canvas 操作**

```javascript
// 不好的做法：多次调用 fillRect
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

**优化 3：使用 Path2D**

```javascript
const path = new Path2D();
path.rect(0, 0, 100, 100);
path.arc(50, 50, 50, 0, Math.PI * 2);

// 复用 Path2D
ctx.fill(path);
ctx.stroke(path);
```

## 浏览器支持

2026 年 Paint API 的浏览器支持：

| 浏览器 | 支持版本 | 状态 |
|--------|---------|------|
| Chrome | 65+ | 完全支持 |
| Edge | 79+ | 完全支持 |
| Firefox | 101+ | 完全支持 |
| Safari | 16.4+ | 完全支持 |

## 调试技巧

**调试 1：使用 Canvas Inspector**

```javascript
class DebugPattern {
  paint(ctx, size, props) {
    console.log('Paint size:', size);
    console.log('Properties:', props);
    
    // 绘制调试信息
    ctx.fillStyle = 'red';
    ctx.font = '12px monospace';
    ctx.fillText(`Size: ${size.width}x${size.height}`, 10, 20);
  }
}
```

**调试 2：添加可视化辅助**

```javascript
paint(ctx, size, props) {
  // 绘制网格
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)';
  ctx.lineWidth = 0.5;
  
  for (let x = 0; x < size.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
    ctx.stroke();
  }
}
```

## 实际应用场景

**场景 1：动态背景**

```css
.hero {
  --gradient-colors: var(--primary), var(--secondary);
  --gradient-angle: 45deg;
  background: paint(gradientBackground);
}
```

**场景 2：装饰图案**

```css
.card::before {
  --grid-color: rgba(0, 0, 0, 0.05);
  --grid-size: 20px;
  background: paint(gridPattern);
  content: '';
  position: absolute;
  inset: 0;
}
```

**场景 3：性能敏感的装饰**

```css
/* 传统方式：大量 DOM 元素 */
.pattern-bg {
  background-image: url('pattern.svg');
}

/* Paint API：无额外 DOM */
.pattern-bg {
  background: paint(patternPaint);
}
```

## 小结

CSS Houdini Paint API 让开发者可以用 JavaScript 自定义 CSS 绘制函数。它突破了传统 CSS 的能力限制，实现了动态背景、装饰图案等效果。2026 年的 Paint API 已经成熟，浏览器支持良好，性能也足够用于生产环境。好的 Paint Worklet 应该简洁、高效、可复用。
