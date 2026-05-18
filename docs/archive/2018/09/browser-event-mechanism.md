---
title: "深入理解浏览器事件机制"
date: 2018-09-05 10:46:42
tags:
  - 前端
readingTime: 2
description: "浏览器事件是前端开发的基础，但很多人对事件捕获、冒泡、委托的理解不够深入，踩了不少坑。这篇文章系统整理一下。"
---

浏览器事件是前端开发的基础，但很多人对事件捕获、冒泡、委托的理解不够深入，踩了不少坑。这篇文章系统整理一下。

## 事件流的三个阶段

当用户点击一个元素，浏览器经历三个阶段：

```
Window
  └── Document
        └── html
              └── body
                    └── div#container（1. 捕获阶段 ↓）
                          └── button（2. 目标阶段）
                    └── div#container（3. 冒泡阶段 ↑）
```

```javascript
// addEventListener 第三个参数 true = 捕获阶段，false（默认）= 冒泡阶段
element.addEventListener("click", handler, true); // 捕获
element.addEventListener("click", handler, false); // 冒泡（默认）

// 推荐用 options 对象写法，更清晰
element.addEventListener("click", handler, { capture: true });
```

## 阻止冒泡

```javascript
document.getElementById("child").addEventListener("click", (e) => {
  e.stopPropagation(); // 阻止事件继续冒泡
  // e.stopImmediatePropagation()  // 还阻止同元素上的其他监听器
});
```

## 事件委托

不在每个子元素上绑定事件，而是在父元素统一处理，利用冒泡：

```javascript
// 不好的做法：给每个 li 绑定事件（内存消耗大，动态添加的元素无效）
document.querySelectorAll("li").forEach((li) => {
  li.addEventListener("click", handleItemClick);
});

// 好的做法：委托给父元素
document.getElementById("list").addEventListener("click", (e) => {
  const li = e.target.closest("li"); // closest 向上找最近的 li
  if (!li) return;

  const id = li.dataset.id;
  handleItemClick(id);
});

// 动态添加的 li 也能响应事件 ✅
const newLi = document.createElement("li");
newLi.dataset.id = "100";
newLi.textContent = "新项目";
document.getElementById("list").appendChild(newLi);
```

## e.target vs e.currentTarget

```javascript
document.getElementById("parent").addEventListener("click", (e) => {
  console.log(e.target); // 实际触发事件的元素（可能是子元素）
  console.log(e.currentTarget); // 绑定监听器的元素（parent）
});
```

## 常用鼠标事件

```javascript
element.addEventListener("mouseenter", () => {}); // 进入元素，不冒泡
element.addEventListener("mouseleave", () => {}); // 离开元素，不冒泡
element.addEventListener("mouseover", () => {}); // 进入元素或子元素，会冒泡
element.addEventListener("mouseout", () => {}); // 离开元素或子元素，会冒泡
```

`mouseenter` / `mouseleave` 不会在经过子元素时触发，通常更好用。

## 常用键盘事件

```javascript
document.addEventListener("keydown", (e) => {
  console.log(e.key); // 'Enter', 'Escape', 'ArrowUp' 等
  console.log(e.code); // 'KeyA', 'Digit1' 等（物理键）
  console.log(e.keyCode); // 已废弃，用 e.key

  // 组合键
  if (e.ctrlKey && e.key === "z") {
    /* Ctrl+Z */
  }
  if (e.metaKey && e.key === "s") {
    /* Cmd+S */
  }
  if (e.shiftKey && e.key === "Enter") {
    /* Shift+Enter */
  }
});
```

## 自定义事件

```javascript
// 创建和派发自定义事件
const event = new CustomEvent("user:login", {
  bubbles: true,
  cancelable: true,
  detail: { userId: 123, username: "Alice" },
});

document.dispatchEvent(event);

// 监听自定义事件
document.addEventListener("user:login", (e) => {
  console.log(e.detail.username); // 'Alice'
});
```

在 Vue 里可以用这个方式做跨组件通信（虽然 Vuex 更适合）。

## 防抖：频繁触发只执行最后一次

```javascript
// scroll/resize/input 等高频事件需要防抖
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.addEventListener(
  "resize",
  debounce(() => {
    console.log("resize 结束后才执行");
  }, 300),
);
```

## 事件监听器的清除

```javascript
// 常见内存泄漏：绑了事件但没有清除
class Component {
  handleClick = () => {};

  mount() {
    document.addEventListener("click", this.handleClick);
  }

  destroy() {
    // 必须清除！否则组件已销毁，监听器还在
    document.removeEventListener("click", this.handleClick);
  }
}

// 使用 AbortController（新方式，更优雅）
const controller = new AbortController();
document.addEventListener("click", handler, { signal: controller.signal });

// 清除时
controller.abort(); // 移除所有用该 signal 绑定的监听器
```

## 小结

- 事件经过捕获 → 目标 → 冒泡三个阶段
- 事件委托利用冒泡，减少事件绑定，支持动态元素
- `e.target` 是触发元素，`e.currentTarget` 是绑定监听的元素
- `mouseenter` / `mouseleave` 不冒泡，通常比 `mouseover` / `mouseout` 好用
- 记得在组件销毁时清除事件监听，防止内存泄漏
