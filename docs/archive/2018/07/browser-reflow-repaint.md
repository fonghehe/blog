---
title: "浏览器渲染性能：重绘与回流"
date: 2018-07-28 16:01:10
tags:
  - 性能优化
readingTime: 1
description: "写了一个复杂的动画，发现很卡。研究了一下重绘和回流的原理，整理优化方法。"
---

写了一个复杂的动画，发现很卡。研究了一下重绘和回流的原理，整理优化方法。

## 浏览器渲染流程

```
Parse HTML/CSS
    ↓
DOM Tree + CSSOM Tree
    ↓
Render Tree（只含可见节点）
    ↓
Layout（回流）← 计算位置和尺寸
    ↓
Paint（重绘）← 填充像素
    ↓
Composite（合成）← 图层合并
```

## 回流（Reflow / Layout）

几何属性变化，需要重新计算布局：

```javascript
// 触发回流的操作
el.style.width = "100px"; // 宽高
el.style.top = "20px"; // 位置
el.style.fontSize = "16px"; // 字体大小影响布局
el.className = "new-class"; // 可能改变布局
document.body.appendChild(newEl); // DOM 结构变化

// 读取以下属性也会强制触发回流（为了获取准确值）
el.offsetWidth;
el.clientHeight;
el.getBoundingClientRect();
window.getComputedStyle(el);
```

## 重绘（Repaint）

视觉属性变化，不影响布局，只需重新绘制：

```javascript
// 只触发重绘，不触发回流
el.style.color = "red";
el.style.backgroundColor = "#fff";
el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
el.style.visibility = "hidden"; // 不同于 display:none（会回流）
```

**回流一定触发重绘，重绘不一定回流**。

## 优化：批量操作

```javascript
// ❌ 每次修改都触发回流
el.style.width = "100px";
el.style.height = "200px";
el.style.left = "50px";

// ✅ 修改 class，一次回流
el.className = "new-size";

// ✅ 用 cssText 批量修改
el.style.cssText = "width: 100px; height: 200px; left: 50px;";

// ✅ 先离线修改，再插入
const fragment = document.createDocumentFragment();
items.forEach((item) => fragment.appendChild(createEl(item)));
container.appendChild(fragment); // 只触发一次回流
```

## 优化：避免强制同步布局

```javascript
// ❌ 读后写交叉，每次都强制回流
items.forEach((item) => {
  const height = item.offsetHeight; // 触发回流，读最新值
  item.style.height = height + 10 + "px"; // 写
});

// ✅ 先统一读，再统一写
const heights = items.map((item) => item.offsetHeight); // 统一读
items.forEach((item, i) => {
  item.style.height = heights[i] + 10 + "px"; // 统一写
});
```

## 优化：合成层（GPU 加速）

以下属性触发 GPU 合成，不需要主线程回流重绘：

```css
/* 推荐用于动画 */
transform: translate/scale/rotate
opacity

/* 会触发合成层 */
.animated {
  will-change: transform; /* 告诉浏览器提前准备合成层 */
}
```

```javascript
// ❌ 用 top/left 做动画（触发回流）
el.style.top = y + "px";
el.style.left = x + "px";

// ✅ 用 transform 做动画（只触发合成，GPU 加速）
el.style.transform = `translate(${x}px, ${y}px)`;
```

## requestAnimationFrame

动画放在 rAF 里，和浏览器渲染节奏同步：

```javascript
function animate() {
  // 在下一帧绘制前执行
  updatePosition();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

## 小结

- 回流（几何变化）> 重绘（视觉变化）> 合成（transform/opacity）
- 批量 DOM 操作，避免读写交叉触发强制同步布局
- 动画用 `transform` 替代 `top/left`，触发 GPU 合成
- `will-change: transform` 提前创建合成层
- 动画用 `requestAnimationFrame` 而非 `setInterval`
