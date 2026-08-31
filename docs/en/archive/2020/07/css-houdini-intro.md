---
title: "Getting Started with CSS Houdini: Paint Worklet and Custom Property Rendering"
date: 2020-07-31 17:45:52
tags:
  - CSS
readingTime: 2
description: "An introduction to CSS Houdini, a set of low-level APIs that let developers hook into the browser's rendering pipeline, with a focus on the widely-supported Paint Worklet."
wordCount: 203
---

CSS Houdini is a set of low-level CSS APIs that let developers hook into the browser's CSS rendering pipeline. Among them, the **Paint Worklet** currently has the best browser support and is the most practical part — it is available in Chrome 65+.

## What Is CSS Houdini

The problem with traditional CSS: if you want a style effect the browser doesn't support natively (such as a custom border-image or background pattern), you can only fall back to images or JavaScript hacks.

Houdini lets you **extend CSS** with JavaScript:

```
CSS Houdini 包含的 API：
├── CSS Properties and Values API  (自定义属性 + 类型)
├── Paint Worklet API              (自定义背景/边框绘制)
├── Layout Worklet API             (自定义布局算法)
├── Animation Worklet API          (自定义动画)
└── CSS Typed OM                   (类型化的 CSS 值操作)
```

## Paint Worklet: Custom Background Drawing

Let's create a "colored checkerboard" background:

```javascript
// checkerboard.js（Paint Worklet 文件）
class CheckerboardPainter {
  // 声明这个 painter 使用的 CSS 自定义属性
  static get inputProperties() {
    return ["--checkerboard-size", "--checkerboard-color"];
  }

  paint(ctx, geom, properties) {
    const size = parseInt(properties.get("--checkerboard-size")) || 20;
    const color =
      properties.get("--checkerboard-color").toString() || "rgba(0,0,0,0.1)";

    for (let y = 0; y < geom.height; y += size) {
      for (let x = 0; x < geom.width; x += size) {
        const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
        if (isEven) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }
}

registerPaint("checkerboard", CheckerboardPainter);
```

```javascript
// 主线程注册 worklet
CSS.paintWorklet.addModule("./checkerboard.js");
```

```css
/* 使用 */
.element {
  --checkerboard-size: 30;
  --checkerboard-color: rgba(100, 100, 255, 0.15);
  background: paint(checkerboard);
  width: 300px;
  height: 200px;
}
```

## CSS Properties and Values API

Typed custom properties let you animate transitions:

```javascript
// 注册类型化的自定义属性
CSS.registerProperty({
  name: "--gradient-angle",
  syntax: "<angle>", // 类型：角度
  inherits: false,
  initialValue: "0deg",
});
```

```css
.button {
  --gradient-angle: 0deg;
  background: linear-gradient(var(--gradient-angle), #ff6b6b, #4ecdc4);
  transition: --gradient-angle 0.5s ease; /* 可以过渡！ */
}

.button:hover {
  --gradient-angle: 135deg;
}
```

Without `CSS.registerProperty`, `--gradient-angle` is just a string and can't participate in a `transition`. Once the property is registered with a type, the browser knows how to interpolate between `0deg` and `135deg`.

## Practical Example: Wavy Underline

```javascript
// wavy-underline.js
class WavyUnderline {
  static get inputProperties() {
    return ["--wave-color", "--wave-size"];
  }

  paint(ctx, geom, props) {
    const color = props.get("--wave-color").toString() || "#ff0000";
    const size = parseInt(props.get("--wave-size")) || 4;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const y = geom.height - size;
    for (let x = 0; x < geom.width; x += size * 2) {
      ctx.arc(x + size, y, size, Math.PI, 0);
      ctx.arc(x + size * 3, y, size, 0, Math.PI);
    }
    ctx.stroke();
  }
}

registerPaint("wavy-underline", WavyUnderline);
```

```css
.error-text {
  --wave-color: red;
  --wave-size: 3;
  background: paint(wavy-underline);
  padding-bottom: 6px;
}
```

## Compatibility Handling

```javascript
if ("paintWorklet" in CSS) {
  CSS.paintWorklet.addModule("./checkerboard.js");
} else {
  // 降级：用普通背景图片
  document.documentElement.classList.add("no-houdini");
}
```

## Summary

The Paint Worklet in CSS Houdini is already usable in production in Chrome. Its significance goes beyond "drawing a few nice backgrounds" — it sets a precedent for **extending the browser's rendering pipeline**, and perhaps one day even the CSS layout engine could be community-extensible. Learning it now is an investment in the future.
