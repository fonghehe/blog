---
title: "移动端适配：从 rem 到 vw/vh"
date: 2018-04-05 09:43:44
tags:
  - CSS
---

移动端适配是前端绕不开的话题。从早期的百分比布局，到 rem 方案，再到现在的 vw/vh，各有利弊。整理一下各方案的原理和选择依据。

## 为什么需要适配

移动设备屏幕宽度差异巨大：320px（iPhone 5）→ 414px（iPhone 8 Plus）→ 768px（iPad）。

设计师通常给 375px 的设计稿，需要在各种尺寸屏幕上等比缩放。

## 方案一：viewport meta

这是所有方案的基础，告诉浏览器如何处理视口：

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

- `width=device-width`：视口宽度等于设备宽度
- `initial-scale=1.0`：初始缩放比例 1:1
- `user-scalable=no`：禁止用户缩放（争议：无障碍访问需要能缩放）

## 方案二：rem + flexible.js

rem 是相对于根元素 `<html>` 字体大小的单位。flexible.js（淘宝方案）动态设置根字体大小：

```javascript
// flexible.js 的核心逻辑（简化版）
(function () {
  const docEl = document.documentElement;

  function setRemUnit() {
    // 以 375px 设计稿为基准，1rem = 设备宽度/10
    const rem = docEl.clientWidth / 10;
    docEl.style.fontSize = rem + "px";
  }

  setRemUnit();
  window.addEventListener("resize", setRemUnit);
})();
```

在 375px 设备上：`1rem = 37.5px`

设计稿上 `75px` 的元素 = `75/37.5 = 2rem`

### 配合 PostCSS 自动转换

每次手动计算 px → rem 很繁琐，用 `postcss-pxtorem` 自动处理：

```bash
npm install postcss-pxtorem
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 37.5, // 基准：1rem = 37.5px（对应 375px 设计稿）
      propList: ["*"], // 转换所有属性
      selectorBlackList: [".norem"], // 这个 class 不转换
    },
  },
};
```

```css
/* 写 px */
.button {
  width: 200px;
  height: 44px;
  font-size: 14px;
}

/* 编译后自动变成 rem */
.button {
  width: 5.33333rem;
  height: 1.17333rem;
  font-size: 0.37333rem;
}
```

## 方案三：vw/vh（现代方案）

`vw` = 视口宽度的 1%，`vh` = 视口高度的 1%。

在 375px 设备上：`1vw = 3.75px`

设计稿上 `75px` = `75/3.75 = 20vw`

**优点：**

- 不需要 JavaScript，纯 CSS
- 没有脚本依赖，更稳健

**用 `postcss-px-to-viewport` 自动转换：**

```bash
npm install postcss-px-to-viewport
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-px-to-viewport": {
      viewportWidth: 375, // 设计稿宽度
      viewportHeight: 667,
      unitPrecision: 5, // 精度
      viewportUnit: "vw", // 转换目标单位
      selectorBlackList: [".ignore"], // 不转换
      minPixelValue: 1, // 小于 1px 不转换
      mediaQuery: false, // 不转换媒体查询里的 px
    },
  },
};
```

## 方案四：1px 问题

这是移动端适配最头疼的问题：设计稿的 1px 在 Retina 屏（DPR=2）上实际显示 2px，看起来很粗。

**物理像素 vs CSS 像素：**

- iPhone 的 DPR = 2，意味着 1 CSS px = 2 物理像素
- 1px 的边框在 Retina 屏上看起来是 2 物理像素宽

**解决方案：伪元素 + transform**

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

## 如何选择

| 方案            | 适用场景                               |
| --------------- | -------------------------------------- |
| rem + flexible  | 需要兼容旧版 Android，团队熟悉这套     |
| vw/vh           | 新项目，兼容性要求 iOS 8+/Android 4.4+ |
| 固定宽度 + 居中 | PC 官网移动版，不需要等比缩放          |

2018 年的实际情况：主流方案还是 rem，vw/vh 在新项目里可以用了。

## 小结

- rem 方案成熟，生态好，需要 JS 配合
- vw/vh 更简洁，不依赖 JS，兼容性已经够用
- 两者都配合 PostCSS 自动转换，写代码直接用设计稿 px 值
- 1px 问题用伪元素 + transform scaleY 解决
