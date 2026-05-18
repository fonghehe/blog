---
title: "CSS 動畫效能：transform 和 opacity"
date: 2018-10-03 11:29:08
tags:
  - CSS
readingTime: 1
description: "做了一個滑入動畫，手機上卡頓明顯。排查後發現是用了 `margin`/`top` 做動畫，改成 `transform` 之後流暢了很多。"
---

做了一個滑入動畫，手機上卡頓明顯。排查後發現是用了 `margin`/`top` 做動畫，改成 `transform` 之後流暢了很多。

## 為什麼 transform 快

瀏覽器渲染流水線：

```
JavaScript → Style → Layout → Paint → Composite
（JS執行）  （樣式計算）（佈局）（繪製） （合成）
```

不同屬性觸發的流程不同：

```
left/top/margin/width/height → 觸發 Layout（重排）+ Paint + Composite
  - 改變了元素的幾何資訊
  - 需要重新計算所有相關元素的位置
  - 最慢

background/color/visibility → 觸發 Paint（重繪）+ Composite
  - 不改變幾何，但要重新畫畫素
  - 中等

transform/opacity → 只觸發 Composite（合成）
  - 不影響文件流，由 GPU 在獨立的層上處理
  - 最快
```

## 實踐對比

```css
/* ❌ 慢：觸發重排 */
@keyframes slide-in-bad {
  from {
    left: -100px;
  }
  to {
    left: 0;
  }
}

/* ✅ 快：只觸發合成 */
@keyframes slide-in-good {
  from {
    transform: translateX(-100px);
  }
  to {
    transform: translateX(0);
  }
}

/* ❌ 慢：改變尺寸觸發重排 */
@keyframes expand-bad {
  from {
    width: 100px;
    height: 100px;
  }
  to {
    width: 200px;
    height: 200px;
  }
}

/* ✅ 快：用 scale 代替 */
@keyframes expand-good {
  from {
    transform: scale(0.5);
  }
  to {
    transform: scale(1);
  }
}
```

## will-change：提示瀏覽器提前準備

```css
/* 提示瀏覽器這個元素會有動畫，提前建立合成層 */
.animated-element {
  will-change: transform;
}

/* 或者用 translateZ(0) 的黑魔法（老方法，不推薦）*/
.animated-element {
  transform: translateZ(0);
}
```

**注意**：不要濫用 `will-change`，每個合成層會佔用額外記憶體：

```css
/* ❌ 給所有元素加（每個都建立合成層，記憶體爆炸）*/
* {
  will-change: transform;
}

/* ✅ 只在真正需要動畫的元素上加，動畫結束後移除 */
.card:hover {
  will-change: transform;
}
```

## 用 JS 控制 will-change

```javascript
// 更精細的控制：hover 時加，離開時移除
element.addEventListener("mouseenter", () => {
  element.style.willChange = "transform";
});
element.addEventListener("animationend", () => {
  element.style.willChange = "auto"; // 釋放資源
});
```

## 除錯工具

Chrome DevTools → Rendering 面板：

- **Paint flashing**：綠色高亮顯示哪些區域在重繪，面積越大越慢
- **Layer borders**：顯示合成層邊界，瞭解有多少層
- **FPS meter**：即時幀率

## 流暢動畫的實踐

```css
/* 完整的流暢卡片懸停效果 */
.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  will-change: transform;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 注意：box-shadow 變化會觸發 Paint，但比 margin 好 */
```

## 小結

- `transform` 和 `opacity` 只觸發合成，是最快的動畫屬性
- 避免動畫 `left/top/width/height/margin`（觸發重排）
- `will-change: transform` 告知瀏覽器提前準備，但不要濫用
- 用 DevTools 的 Paint flashing 驗證重繪範圍
