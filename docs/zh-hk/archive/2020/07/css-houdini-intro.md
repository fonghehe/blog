---
title: "CSS Houdini 入門：Paint Worklet 與自定義屬性渲染"
date: 2020-07-31 17:45:52
tags:
  - CSS
readingTime: 2
description: "CSS Houdini 是一組底層 CSS API，讓開發者可以介入瀏覽器的 CSS 渲染流程。其中 **Paint Worklet** 是目前兼容性最好、最實用的部分，Chrome 65+ 已經支持。"
wordCount: 286
---

CSS Houdini 是一組底層 CSS API，讓開發者可以介入瀏覽器的 CSS 渲染流程。其中 **Paint Worklet** 是目前兼容性最好、最實用的部分，Chrome 65+ 已經支持。

## 什麼是 CSS Houdini

傳統 CSS 的問題：如果你想實現一個瀏覽器不支持的樣式效果（比如自定義的 border-image 或背景圖案），只能用圖片或 JavaScript hack。

Houdini 讓你可以用 JavaScript **擴展 CSS**：

```
CSS Houdini 包含的 API：
├── CSS Properties and Values API  (自定義屬性 + 類型)
├── Paint Worklet API              (自定義背景/邊框繪製)
├── Layout Worklet API             (自定義佈局算法)
├── Animation Worklet API          (自定義動畫)
└── CSS Typed OM                   (類型化的 CSS 值操作)
```

## Paint Worklet：自定義背景繪製

創建一個"彩色格子"背景：

```javascript
// checkerboard.js（Paint Worklet 文件）
class CheckerboardPainter {
  // 聲明這個 painter 使用的 CSS 自定義屬性
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
// 主線程註冊 worklet
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

讓自定義屬性擁有類型，實現動畫過渡：

```javascript
// 註冊類型化的自定義屬性
CSS.registerProperty({
  name: "--gradient-angle",
  syntax: "<angle>", // 類型：角度
  inherits: false,
  initialValue: "0deg",
});
```

```css
.button {
  --gradient-angle: 0deg;
  background: linear-gradient(var(--gradient-angle), #ff6b6b, #4ecdc4);
  transition: --gradient-angle 0.5s ease; /* 可以過渡！ */
}

.button:hover {
  --gradient-angle: 135deg;
}
```

沒有 `CSS.registerProperty`，`--gradient-angle` 只是個字符串，無法參與 `transition`。註冊類型後，瀏覽器知道如何在 `0deg` 和 `135deg` 之間插值。

## 實用案例：波浪線下劃線

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

## 兼容性處理

```javascript
if ("paintWorklet" in CSS) {
  CSS.paintWorklet.addModule("./checkerboard.js");
} else {
  // 降級：用普通背景圖片
  document.documentElement.classList.add("no-houdini");
}
```

## 總結

CSS Houdini 中的 Paint Worklet 已經在 Chrome 中可以用於生產。它的意義不只是"畫幾個好看的背景"，而是開創了**瀏覽器渲染擴展點**的先例——未來或許連 CSS 佈局引擎也能由社區擴展。現在學習是投資未來。
