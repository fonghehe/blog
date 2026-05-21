---
title: "モバイルアダプテーション：rem から vw/vh へ"
date: 2018-04-05 09:43:44
tags:
  - CSS
readingTime: 4
description: "モバイルアダプテーションはフロントエンド開発で避けられないテーマです。初期のパーセントレイアウト、rem 方式、そして現在の vw/vh と、それぞれにメリット・デメリットがあります。各方式の原理と選択基準を整理します。"
wordCount: 847
---

モバイルアダプテーションはフロントエンド開発で避けられないテーマです。初期のパーセントレイアウト、rem 方式、そして現在の vw/vh と、それぞれにメリット・デメリットがあります。各方式の原理と選択基準を整理します。

## なぜアダプテーションが必要なのか

モバイル端末の画面幅は大きく異なります：320px（iPhone 5）→ 414px（iPhone 8 Plus）→ 768px（iPad）。

デザイナーは通常 375px のデザインを提供しますが、様々な画面サイズで等比率にスケールさせる必要があります。

## 方法 1：viewport meta

すべての方法の基礎です。ブラウザにビューポートの扱い方を伝えます：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

- `width=device-width`：ビューポート幅 = デバイス幅
- `initial-scale=1.0`：初期ズーム比率 1:1
- `user-scalable=no`：ユーザーによるズームを禁止（アクセシビリティの観点から議論あり）

## 方法 2：rem + flexible.js

`rem` は `<html>` ルート要素のフォントサイズに対する相対単位です。flexible.js（タオバオ方式）は動的にルートフォントサイズを設定します：

```javascript
// flexible.js のコアロジック（簡略版）
(function () {
  const docEl = document.documentElement;

  function setRemUnit() {
    // 375px デザインを基準に、1rem = デバイス幅 / 10
    const rem = docEl.clientWidth / 10;
    docEl.style.fontSize = rem + "px";
  }

  setRemUnit();
  window.addEventListener("resize", setRemUnit);
})();
```

375px のデバイスでは：`1rem = 37.5px`

デザイン上の `75px` の要素 = `75 / 37.5 = 2rem`

### PostCSS で自動変換

px → rem を毎回手計算するのは面倒です。`postcss-pxtorem` で自動化できます：

```bash
npm install postcss-pxtorem
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 37.5, // 基準：1rem = 37.5px（375px デザイン用）
      propList: ["*"], // 全プロパティを変換
      selectorBlackList: [".norem"], // このクラスは変換しない
    },
  },
};
```

```css
/* px で書く */
.button {
  width: 200px;
  height: 44px;
  font-size: 14px;
}

/* コンパイル後 — 自動的に rem に変換 */
.button {
  width: 5.33333rem;
  height: 1.17333rem;
  font-size: 0.37333rem;
}
```

## 方法 3：vw/vh（モダンな方法）

`vw` = ビューポート幅の 1%、`vh` = ビューポート高さの 1%。

375px のデバイスでは：`1vw = 3.75px`

デザイン上の `75px` = `75 / 3.75 = 20vw`

**メリット：**

- JavaScript 不要 — 純粋な CSS
- スクリプト依存なし、より堅牢

**`postcss-px-to-viewport` で自動変換：**

```bash
npm install postcss-px-to-viewport
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-px-to-viewport": {
      viewportWidth: 375, // デザイン幅
      viewportHeight: 667,
      unitPrecision: 5, // 精度
      viewportUnit: "vw", // 変換先の単位
      selectorBlackList: [".ignore"], // 変換しない
      minPixelValue: 1, // 1px 未満は変換しない
      mediaQuery: false, // メディアクエリ内の px は変換しない
    },
  },
};
```

## 方法 4：1px 問題

モバイルアダプテーションで最も厄介な問題：デザインの 1px ボーダーが Retina スクリーン（DPR=2）では 2px に見えてしまう。

**物理ピクセル vs CSS ピクセル：**

- iPhone の DPR = 2 なので、1 CSS px = 2 物理ピクセル
- Retina スクリーンでは 1px ボーダーが 2 物理ピクセル幅に見える

**解決策：疑似要素 + transform**

```scss
@mixin border-1px($color: #eee) {
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background-color: $color;
    transform-origin: 0 bottom;

    @media (-webkit-min-device-pixel-ratio: 2) {
      transform: scaleY(0.5);
    }
    @media (-webkit-min-device-pixel-ratio: 3) {
      transform: scaleY(0.333);
    }
  }
}
```

## 選び方

| 方法              | 適した場面                                                |
| ----------------- | --------------------------------------------------------- |
| rem + flexible    | 旧 Android への対応が必要、チームがこの方式に慣れている   |
| vw/vh             | 新プロジェクト、対応要件：iOS 8+ / Android 4.4+           |
| 固定幅 + 中央揃え | PC 向けマーケティングページのモバイル版、等比スケール不要 |

2018 年の実情：rem がまだ主流でしたが、vw/vh は新プロジェクトで使えるようになっていました。

## まとめ

- rem は成熟しておりエコシステムが充実しているが、JavaScript が必要
- vw/vh はすっきりしており JS に依存せず、ブラウザ対応も十分
- どちらも PostCSS の自動変換と組み合わせると、コードにはデザイン仕様の px 値をそのまま書ける
- 1px 問題は疑似要素 + transform scaleY で解決する
