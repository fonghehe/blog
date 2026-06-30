---
title: "CSS Houdini Paint API Custom Drawing Practice"
date: 2026-06-30 13:18:00
tags:
  - CSS
readingTime: 2
description: "CSS Houdini Paint API lets developers use JavaScript to define custom CSS paint functions, achieving effects impossible with traditional CSS. This article discusses Paint API's working principles, practical usage, and performance optimization."
wordCount: 125
---

CSS Houdini Paint API is a major extension of the Web platform. It allows developers to define custom CSS paint functions using JavaScript, breaking through traditional CSS capability limitations.

## Paint API Basics

Paint API's core is `PaintWorklet`:

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
/* Use in CSS */
.box {
  --gradient-colors: #ff6b6b, #4ecdc4, #45b7d1;
  --gradient-angle: 135deg;
  background: paint(gradientBackground);
}
```

## Practical Cases

**Case 1: Wave Background**

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

**Case 2: Grid Pattern**

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
    
    // Vertical lines
    for (let x = 0; x <= size.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    
    // Horizontal lines
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

## Performance Optimization

**Optimization 1: Cache computation results**

```javascript
class OptimizedPattern {
  paint(ctx, size, props) {
    const patternSize = parseFloat(props.get('--pattern-size')) || 10;
    const cache = new Map();
    
    for (let x = 0; x < size.width; x += patternSize) {
      for (let y = 0; y < size.height; y += patternSize) {
        const key = `${x},${y}`;
        if (!cache.has(key)) {
          cache.set(key, this.calculatePattern(x, y));
        }
      }
    }
  }
}
```

**Optimization 2: Reduce Canvas operations**

```javascript
// Bad practice: multiple fillRect calls
for (let i = 0; i < 1000; i++) {
  ctx.fillRect(x, y, 10, 10);
}

// Good practice: batch operations
ctx.beginPath();
for (let i = 0; i < 1000; i++) {
  ctx.rect(x, y, 10, 10);
}
ctx.fill();
```

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 65+ | Full support |
| Edge | 79+ | Full support |
| Firefox | 101+ | Full support |
| Safari | 16.4+ | Full support |

## Summary

CSS Houdini Paint API lets developers use JavaScript to define custom CSS paint functions. It breaks through traditional CSS capability limitations, implementing dynamic backgrounds, decorative patterns, and other effects. 2026's Paint API is mature, with good browser support and sufficient performance for production use.
