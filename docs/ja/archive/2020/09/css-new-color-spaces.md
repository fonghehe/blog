---
title: "新しいCSSカラースペースの探求：LabとLCH"
date: 2020-09-14 11:27:45
tags:
  - CSS
readingTime: 4
description: "デザインシステムのカラーパレットを作成している中で、CSS の色仕様が sRGB からより広い色空間へと拡張されつつあることに気づきました。Chrome ではすでに lab()、lch()、color() 関数の実験的サポートが始まっています。まだ本番環境では使用できませんが、フロントエンドエンジニアとしてこれらの今後の変化を理解しておく必要があります。"
wordCount: 928
---

最近、デザインシステムのカラーパレットを作成している中で、CSS の色仕様が sRGB からより広い色空間へと拡張されつつあることに気づきました。Chrome ではすでに `lab()`、`lch()`、`color()` 関数の実験的サポートが始まっています。まだ本番環境では使用できませんが、フロントエンドエンジニアとしてこれらの今後の変化を理解しておく必要があります。

## なぜ新しい色空間が必要なのか

sRGB が表現できる色の範囲（色域）は限られています。現在、ますます多くのデバイスが Display P3 広色域（すべての Apple デバイス、ハイエンドモニター）をサポートしており、CSS が sRGB のみを使用する場合、これらのハードウェアの能力を十分に活用できません。

さらに重要なのは、sRGB の色相は明度が変化すると彩度が失われることです。これが、`hsl()` で色を調整する際に、明度を 50% にした色相と明度 90% の色相がまったく異なって見える理由です。

## Lab 色空間

Lab（CIELAB）は知覚的に均一な色空間で、3つのチャンネルがあります：
- **L**：明度、0（黒）から 100（白）
- **a**：赤-緑軸、負の値は緑寄り、正の値は赤寄り
- **b**：黄-青軸、負の値は青寄り、正の値は黄寄り

```css
/* Lab 语法 */
color: lab(50% 40 30);       /* 中等亮度，偏红偏黄 */
color: lab(80% -20 -10);     /* 高亮度，偏绿偏蓝 */
color: lab(20% 0 0);         /* 低亮度，中性灰 */

/* 带透明度 */
color: lab(50% 40 30 / 0.8);
```

## LCH 色空間

LCH は Lab の極座標表現で、より直感的です：
- **L**：明度、0 から 100
- **C**：彩度（クロマ）、0（グレー）から ~150（理論上の最大値）
- **H**：色相角度、0-360 度

```css
/* LCH 语法 —— 和 HSL 类似但更直观 */
color: lch(50% 60 0);        /* 中亮度，高饱和度，红色 */
color: lch(50% 60 120);      /* 中亮度，高饱和度，绿色 */
color: lch(50% 60 240);      /* 中亮度，高饱和度，蓝色 */

/* 淡色 —— 降低色度 */
color: lch(80% 20 270);      /* 高亮度，低饱和度，淡紫色 */

/* 灰色 —— 色度为 0 */
color: lch(50% 0 0);         /* 中性灰 */
```

## LCH vs HSL の核心的な違い

これは最も理解すべき部分です。HSL でデザインシステムのカラーグラデーションを作成する場合、人間の目が知覚する明度の変化は均一ではありません。LCH はこの問題を解決します：

```css
/* HSL の問題：同じ明度の値でも、色相が異なると明るさの見え方が大きく異なる */
/* これらは両方とも 50% 明度だが、黄色は青色よりもはるかに明るく見える */
.hsl-yellow { color: hsl(60, 100%, 50%); }
.hsl-blue   { color: hsl(240, 100%, 50%); }

/* LCH：同じ明度の値でも、異なる色相で明るさの見え方が一致する */
.lch-yellow { color: lch(60% 80 100); }
.lch-blue   { color: lch(60% 80 270); }
/* 人間の目が知覚する明るさは同じになる */
```

## 实战：用 LCH 构建颜色系统

LCH 特别适合构建设计系统的色彩梯度，因为只需调整亮度（L）就能得到一致的亮暗色阶：

```css
:root {
  /* ベースカラー */
  --color-hue: 250;       /* 青紫色 */
  --color-chroma: 80;     /* 彩度 */

  /* 色階調 —— L の値のみを調整 */
  --color-50:  lch(97% calc(var(--color-chroma) * 0.1) var(--color-hue));
  --color-100: lch(93% calc(var(--color-chroma) * 0.2) var(--color-hue));
  --color-200: lch(85% calc(var(--color-chroma) * 0.4) var(--color-hue));
  --color-300: lch(75% calc(var(--color-chroma) * 0.6) var(--color-hue));
  --color-400: lch(65% calc(var(--color-chroma) * 0.8) var(--color-hue));
  --color-500: lch(55% var(--color-chroma) var(--color-hue));       /* メインカラー */
  --color-600: lch(45% var(--color-chroma) var(--color-hue));
  --color-700: lch(35% var(--color-chroma) var(--color-hue));
  --color-800: lch(25% var(--color-chroma) var(--color-hue));
  --color-900: lch(15% var(--color-chroma) var(--color-hue));

  /* セマンティックカラー */
  --color-success: lch(55% 70 145);    /* 緑 */
  --color-warning: lch(75% 80 85);     /* 黄 */
  --color-error:   lch(50% 80 25);     /* 赤 */
  --color-info:    lch(55% 40 250);    /* 青 */
}
```

JavaScript で色階調を生成する：

```typescript
// Style Values API（将来の API）または手動で生成
function generateColorScale(hue: number, chroma: number) {
  const levels = [97, 93, 85, 75, 65, 55, 45, 35, 25, 15]
  const scaleFactors = [0.1, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1, 1]
  const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

  return stops.reduce((acc, stop, i) => {
    acc[`--color-${stop}`] = `lch(${levels[i]}% ${chroma * scaleFactors[i]} ${hue})`
    return acc
  }, {} as Record<string, string>)
}

console.log(generateColorScale(250, 80))
```

## color() 関数：色域の指定

`color()` 関数は具体的な色空間を指定できます：

```css
/* sRGB 色域（デフォルト） */
color: color(srgb 0.5 0.3 0.8);

/* Display P3 色域 —— より広い色域 */
color: color(display-p3 0.5 0.3 0.8);

/* フォールバック付きの書き方 */
.element {
  /* sRGB にフォールバック */
  color: rgb(128, 77, 204);
  /* 広色域で上書き */
  color: color(display-p3 0.5 0.3 0.8);
}
```

## ブラウザサポートとプログレッシブエンハンスメント

現在（2020 年 9 月時点）Lab/LCH はまだ実験段階です。`@supports` を使用してプログレッシブエンハンスメントが可能です：

```css
.theme-primary {
  /* ベースカラー：sRGB フォールバック */
  color: rgb(90, 50, 180);
}

@supports (color: lab(50% 0 0)) {
  .theme-primary {
    color: lch(45% 80 290);
  }
}
```

```javascript
// JavaScript でのサポート検出
function supportsLab() {
  const el = document.createElement('div')
  el.style.color = 'lab(50% 0 0)'
  return el.style.color !== ''
}
```

## まとめ

- Lab/LCH は知覚的に均一な色空間で、人間の目が知覚する明度の変化がより線形です
- LCH はデザインシステムの色階調の構築に適しており、明度を調整する際に色相と彩度が安定します
- LCH の HSL に対する中核的な優位性は、明度の知覚が均一であることです
- `color()` 関数は色域の指定をサポートし、Display P3 広色域を活用できます
- 現在のブラウザサポートは限られているため、`@supports` を使用したプログレッシブエンハンスメントを推奨します
- これは CSS 色仕様の将来の方向性であり、事前に学ぶ価値があります
