---
title: "瀏覽器渲染效能：重繪與迴流"
date: 2018-07-28 16:01:10
tags:
  - 效能最佳化
readingTime: 1
description: "寫了一個複雜的動畫，發現很卡。研究了一下重繪和迴流的原理，整理最佳化方法。"
wordCount: 234
---

寫了一個複雜的動畫，發現很卡。研究了一下重繪和迴流的原理，整理最佳化方法。

## 瀏覽器渲染流程

```
Parse HTML/CSS
    ↓
DOM Tree + CSSOM Tree
    ↓
Render Tree（只含可見節點）
    ↓
Layout（迴流）← 計算位置和尺寸
    ↓
Paint（重繪）← 填充畫素
    ↓
Composite（合成）← 圖層合併
```

## 迴流（Reflow / Layout）

幾何屬性變化，需要重新計算佈局：

```javascript
// 觸發迴流的操作
el.style.width = "100px"; // 寬高
el.style.top = "20px"; // 位置
el.style.fontSize = "16px"; // 字型大小影響佈局
el.className = "new-class"; // 可能改變佈局
document.body.appendChild(newEl); // DOM 結構變化

// 讀取以下屬性也會強制觸發迴流（為了獲取準確值）
el.offsetWidth;
el.clientHeight;
el.getBoundingClientRect();
window.getComputedStyle(el);
```

## 重繪（Repaint）

視覺屬性變化，不影響佈局，只需重新繪製：

```javascript
// 只觸發重繪，不觸發迴流
el.style.color = "red";
el.style.backgroundColor = "#fff";
el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
el.style.visibility = "hidden"; // 不同於 display:none（會迴流）
```

**迴流一定觸發重繪，重繪不一定迴流**。

## 最佳化：批次操作

```javascript
// ❌ 每次修改都觸發迴流
el.style.width = "100px";
el.style.height = "200px";
el.style.left = "50px";

// ✅ 修改 class，一次迴流
el.className = "new-size";

// ✅ 用 cssText 批次修改
el.style.cssText = "width: 100px; height: 200px; left: 50px;";

// ✅ 先離線修改，再插入
const fragment = document.createDocumentFragment();
items.forEach((item) => fragment.appendChild(createEl(item)));
container.appendChild(fragment); // 只觸發一次迴流
```

## 最佳化：避免強制同步佈局

```javascript
// ❌ 讀後寫交叉，每次都強制迴流
items.forEach((item) => {
  const height = item.offsetHeight; // 觸發迴流，讀最新值
  item.style.height = height + 10 + "px"; // 寫
});

// ✅ 先統一讀，再統一寫
const heights = items.map((item) => item.offsetHeight); // 統一讀
items.forEach((item, i) => {
  item.style.height = heights[i] + 10 + "px"; // 統一寫
});
```

## 最佳化：合成層（GPU 加速）

以下屬性觸發 GPU 合成，不需要主執行緒迴流重繪：

```css
/* 推薦用於動畫 */
transform: translate/scale/rotate
opacity

/* 會觸發合成層 */
.animated {
  will-change: transform; /* 告訴瀏覽器提前準備合成層 */
}
```

```javascript
// ❌ 用 top/left 做動畫（觸發迴流）
el.style.top = y + "px";
el.style.left = x + "px";

// ✅ 用 transform 做動畫（只觸發合成，GPU 加速）
el.style.transform = `translate(${x}px, ${y}px)`;
```

## requestAnimationFrame

動畫放在 rAF 裡，和瀏覽器渲染節奏同步：

```javascript
function animate() {
  // 在下一幀繪製前執行
  updatePosition();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

## 小結

- 迴流（幾何變化）> 重繪（視覺變化）> 合成（transform/opacity）
- 批次 DOM 操作，避免讀寫交叉觸發強制同步佈局
- 動畫用 `transform` 替代 `top/left`，觸發 GPU 合成
- `will-change: transform` 提前建立合成層
- 動畫用 `requestAnimationFrame` 而非 `setInterval`
