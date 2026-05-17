---
title: "CSS Houdini 入門：Paint WorkletとカスタムプロパティのレンダリングNGS"
date: 2020-07-31 17:45:52
tags:
  - CSS
readingTime: 2
description: "CSS Houdini 是一组底层 CSS API，让开发者可以介入浏览器的 CSS 渲染流程。其中 **Paint Worklet** 是目前兼容性最好、最实用的部分，Chrome 65+ 已经支持。"
---

CSS Houdini 是一组底层 CSS API，让开发者可以介入浏览器的 CSS 渲染流程。其中 **Paint Worklet** 是目前兼容性最好、最实用的部分，Chrome 65+ 已经支持。

## CSS Houdiniとは

传统 CSS 的问题：如果你想实现一个浏览器不支持的样式效果（比如自定义的 border-image 或背景图案），只能用图片或 JavaScript hack。

Houdini 让你可以用 JavaScript **扩展 CSS**：

```
CSS Houdini 包含的 API：
├── CSS Properties and Values API  (自定义属性 + 类型)
├── Paint Worklet API              (自定义背景/边框绘制)
├── Layout Worklet API             (自定义布局算法)
├── Animation Worklet API          (自定义动画)
└── CSS Typed OM                   (类型化的 CSS 值操作)
```

## Paint Worklet：カスタム背景描画

创建一个"彩色格子"背景：

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

让自定义属性拥有类型，实现动画过渡：

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

没有 `CSS.registerProperty`，`--gradient-angle` 只是个字符串，无法参与 `transition`。注册类型后，浏览器知道如何在 `0deg` 和 `135deg` 之间插值。

## 実用例：ウェーブ下線

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

## 互換性の処理

```javascript
if ("paintWorklet" in CSS) {
  CSS.paintWorklet.addModule("./checkerboard.js");
} else {
  // 降级：用普通背景图片
  document.documentElement.classList.add("no-houdini");
}
```

## まとめ

CSS Houdini 中的 Paint Worklet 已经在 Chrome 中可以用于生产。它的意义不只是"画几个好看的背景"，而是开创了**浏览器渲染扩展点**的先例——未来或许连 CSS 布局引擎也能由社区扩展。现在学习是投资未来。
