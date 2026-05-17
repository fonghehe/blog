---
title: "ブラウザレンダリングパフォーマンス：再描画とリフロー"
date: 2018-07-28 16:01:10
tags:
  - パフォーマンス最適化
readingTime: 2
description: "複雑なアニメーションを作ったらカクついたので、再描画とリフローの原理を調べ、最適化方法をまとめました。"
---

複雑なアニメーションを作ったらカクついたので、再描画とリフローの原理を調べ、最適化方法をまとめました。

## ブラウザのレンダリングフロー

```
Parse HTML/CSS
    ↓
DOM Tree + CSSOM Tree
    ↓
Render Tree（表示ノードのみ）
    ↓
Layout（リフロー）← 位置とサイズを計算
    ↓
Paint（再描画）← ピクセルを塗る
    ↓
Composite（合成）← レイヤーを合成
```

## リフロー（Reflow / Layout）

ジオメトリプロパティの変更はレイアウトの再計算が必要です：

```javascript
// リフローを引き起こす操作
el.style.width = "100px"; // 幅・高さ
el.style.top = "20px"; // 位置
el.style.fontSize = "16px"; // フォントサイズはレイアウトに影響
el.className = "new-class"; // レイアウトが変わる可能性がある
document.body.appendChild(newEl); // DOM構造の変化

// 以下のプロパティを読み取るとリフローが強制される（正確な値を得るため）
el.offsetWidth;
el.clientHeight;
el.getBoundingClientRect();
window.getComputedStyle(el);
```

## 再描画（Repaint）

レイアウトに影響しないビジュアルプロパティの変更。再描画のみ必要：

```javascript
// 再描画のみ。リフローは発生しない
el.style.color = "red";
el.style.backgroundColor = "#fff";
el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
el.style.visibility = "hidden"; // display:noneとは異なる（noneはリフローを引き起こす）
```

**リフローは必ず再描画を引き起こしますが、再描画はリフローを引き起こしません。**

## 最適化：バッチDOM操作

```javascript
// ❌ 変更のたびにリフローが発生
el.style.width = "100px";
el.style.height = "200px";
el.style.left = "50px";

// ✅ classを変更してリフローを1回にする
el.className = "new-size";

// ✅ cssTextでまとめて変更
el.style.cssText = "width: 100px; height: 200px; left: 50px;";

// ✅ オフラインで変更してから挿入
const fragment = document.createDocumentFragment();
items.forEach((item) => fragment.appendChild(createEl(item)));
container.appendChild(fragment); // リフローは1回だけ
```

## 最適化：強制同期レイアウトを避ける

```javascript
// ❌ 読み書きが交互で、毎回リフローが強制される
items.forEach((item) => {
  const height = item.offsetHeight; // リフローを発生させて最新値を取得
  item.style.height = height + 10 + "px"; // 書き込み
});

// ✅ まとめて読んでから、まとめて書く
const heights = items.map((item) => item.offsetHeight); // まとめて読む
items.forEach((item, i) => {
  item.style.height = heights[i] + 10 + "px"; // まとめて書く
});
```

## 最適化：合成レイヤー（GPUアクセラレーション）

以下のプロパティはGPU合成を使い、メインスレッドのリフロー・再描画が不要です：

```css
/* アニメーションに推奨 */
transform: translate/scale/rotate
opacity

/* 合成レイヤーを作成 */
.animated {
  will-change: transform; /* ブラウザに合成レイヤーを事前準備させる */
}
```

```javascript
// ❌ top/leftでアニメーション（リフローを引き起こす）
el.style.top = y + "px";
el.style.left = x + "px";

// ✅ transformでアニメーション（合成のみ、GPUアクセラレーション）
el.style.transform = `translate(${x}px, ${y}px)`;
```

## requestAnimationFrame

アニメーションをrAFの中に入れてブラウザのレンダリングリズムに合わせる：

```javascript
function animate() {
  // 次のフレームが描画される直前に実行
  updatePosition();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

## まとめ

- リフロー（ジオメトリ変更）> 再描画（ビジュアル変更）> 合成（transform/opacity）
- DOM操作はまとめて行い、読み書きの交互を避けて強制同期レイアウトを防ぐ
- アニメーションには`top/left`の代わりに`transform`を使ってGPU合成を活用
- `will-change: transform`で合成レイヤーを事前に作成
- アニメーションには`setInterval`の代わりに`requestAnimationFrame`を使う
