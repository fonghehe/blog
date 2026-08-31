---
title: "CSS Houdini 入門：Paint WorkletとカスタムプロパティのレンダリングNGS"
date: 2020-07-31 17:45:52
tags:
  - CSS
readingTime: 2
description: "CSS Houdini 是一组底层 CSS API，让开发者可以介入浏览器的 CSS 渲染流程。其中 **Paint Worklet** 是目前兼容性最好、最实用的部分，Chrome 65+ 已经支持。"
wordCount: 458
---

CSS Houdini は、開発者がブラウザの CSS レンダリングプロセスに介入できるようにする一連の低レベル CSS API だ。中でも **Paint Worklet** は現在もっとも互換性が良く、実用的な部分であり、Chrome 65+ ですでにサポートされている。

## CSS Houdiniとは

従来の CSS の問題点：ブラウザがサポートしていないスタイル効果（カスタムの border-image や背景パターンなど）を実現したい場合、画像か JavaScript のハックしか手段がなかった。

Houdini を使うと、JavaScript で CSS を**拡張**できる：

```
CSS Houdini が含む API：
├── CSS Properties and Values API  (カスタムプロパティ + 型)
├── Paint Worklet API              (カスタム背景/ボーダー描画)
├── Layout Worklet API             (カスタムレイアウトアルゴリズム)
├── Animation Worklet API          (カスタムアニメーション)
└── CSS Typed OM                   (型付き CSS 値の操作)
```

## Paint Worklet：カスタム背景描画

「カラーの格子」背景を作ってみる：

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

カスタムプロパティに型を持たせ、アニメーションのトランジションを実現する：

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

`CSS.registerProperty` がない場合、`--gradient-angle` は単なる文字列に過ぎず、`transition` に参加できない。型を登録すると、ブラウザは `0deg` と `135deg` の間をどう補間するかを理解するようになる。

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

CSS Houdini の Paint Worklet はすでに Chrome で本番利用できる。その意義は「いくつかの見栄えの良い背景を描く」ことだけではなく、**ブラウザのレンダリング拡張ポイント**の先例を開いたことにある。将来的には CSS レイアウトエンジンすらコミュニティが拡張できるようになるかもしれない。今学ぶことは未来への投資だ。
