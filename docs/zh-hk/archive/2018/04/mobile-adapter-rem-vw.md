---
title: "移動端適配：從 rem 到 vw/vh"
date: 2018-04-05 09:43:44
tags:
  - CSS
readingTime: 3
description: "移動端適配是前端繞不開的話題。從早期的百分比佈局，到 rem 方案，再到現在的 vw/vh，各有利弊。整理一下各方案的原理和選擇依據。"
wordCount: 563
---

移動端適配是前端繞不開的話題。從早期的百分比佈局，到 rem 方案，再到現在的 vw/vh，各有利弊。整理一下各方案的原理和選擇依據。

## 為什麼需要適配

移動設備屏幕寬度差異巨大：320px（iPhone 5）→ 414px（iPhone 8 Plus）→ 768px（iPad）。

設計師通常給 375px 的設計稿，需要在各種尺寸屏幕上等比縮放。

## 方案一：viewport meta

這是所有方案的基礎，告訴瀏覽器如何處理視口：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

- `width=device-width`：視口寬度等於設備寬度
- `initial-scale=1.0`：初始縮放比例 1:1
- `user-scalable=no`：禁止用户縮放（爭議：無障礙訪問需要能縮放）

## 方案二：rem + flexible.js

rem 是相對於根元素 `<html>` 字體大小的單位。flexible.js（淘寶方案）動態設置根字體大小：

```javascript
// flexible.js 的核心邏輯（簡化版）
(function () {
  const docEl = document.documentElement;

  function setRemUnit() {
    // 以 375px 設計稿為基準，1rem = 設備寬度/10
    const rem = docEl.clientWidth / 10;
    docEl.style.fontSize = rem + "px";
  }

  setRemUnit();
  window.addEventListener("resize", setRemUnit);
})();
```

在 375px 設備上：`1rem = 37.5px`

設計稿上 `75px` 的元素 = `75/37.5 = 2rem`

### 配合 PostCSS 自動轉換

每次手動計算 px → rem 很繁瑣，用 `postcss-pxtorem` 自動處理：

```bash
npm install postcss-pxtorem
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 37.5, // 基準：1rem = 37.5px（對應 375px 設計稿）
      propList: ["*"], // 轉換所有屬性
      selectorBlackList: [".norem"], // 這個 class 不轉換
    },
  },
};
```

```css
/* 寫 px */
.button {
  width: 200px;
  height: 44px;
  font-size: 14px;
}

/* 編譯後自動變成 rem */
.button {
  width: 5.33333rem;
  height: 1.17333rem;
  font-size: 0.37333rem;
}
```

## 方案三：vw/vh（現代方案）

`vw` = 視口寬度的 1%，`vh` = 視口高度的 1%。

在 375px 設備上：`1vw = 3.75px`

設計稿上 `75px` = `75/3.75 = 20vw`

**優點：**

- 不需要 JavaScript，純 CSS
- 沒有腳本依賴，更穩健

**用 `postcss-px-to-viewport` 自動轉換：**

```bash
npm install postcss-px-to-viewport
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-px-to-viewport": {
      viewportWidth: 375, // 設計稿寬度
      viewportHeight: 667,
      unitPrecision: 5, // 精度
      viewportUnit: "vw", // 轉換目標單位
      selectorBlackList: [".ignore"], // 不轉換
      minPixelValue: 1, // 小於 1px 不轉換
      mediaQuery: false, // 不轉換媒體查詢裏的 px
    },
  },
};
```

## 方案四：1px 問題

這是移動端適配最頭疼的問題：設計稿的 1px 在 Retina 屏（DPR=2）上實際顯示 2px，看起來很粗。

**物理像素 vs CSS 像素：**

- iPhone 的 DPR = 2，意味着 1 CSS px = 2 物理像素
- 1px 的邊框在 Retina 屏上看起來是 2 物理像素寬

**解決方案：偽元素 + transform**

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

## 如何選擇

| 方案            | 適用場景                               |
| 
--------------- | -------------------------------------- |
| rem + flexible  | 需要兼容舊版 Android，團隊熟悉這套     |
| vw/vh           | 新項目，兼容性要求 iOS 8+/Android 4.4+ |
| 固定寬度 + 居中 | PC 官網移動版，不需要等比縮放          |

2018 年的實際情況：主流方案還是 rem，vw/vh 在新項目裏可以用了。

## 小結

- rem 方案成熟，生態好，需要 JS 配合
- vw/vh 更簡潔，不依賴 JS，兼容性已經夠用
- 兩者都配合 PostCSS 自動轉換，寫代碼直接用設計稿 px 值
- 1px 問題用偽元素 + transform scaleY 解決
