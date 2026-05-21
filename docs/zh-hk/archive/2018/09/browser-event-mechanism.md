---
title: "深入理解瀏覽器事件機制"
date: 2018-09-05 10:46:42
tags:
  - 前端
readingTime: 2
description: "瀏覽器事件是前端開發的基礎，但很多人對事件捕獲、冒泡、委託的理解不夠深入，踩了不少坑。這篇文章系統整理一下。"
wordCount: 287
---

瀏覽器事件是前端開發的基礎，但很多人對事件捕獲、冒泡、委託的理解不夠深入，踩了不少坑。這篇文章系統整理一下。

## 事件流的三個階段

當用户點擊一個元素，瀏覽器經歷三個階段：

```
Window
  └── Document
        └── html
              └── body
                    └── div#container（1. 捕獲階段 ↓）
                          └── button（2. 目標階段）
                    └── div#container（3. 冒泡階段 ↑）
```

```javascript
// addEventListener 第三個參數 true = 捕獲階段，false（默認）= 冒泡階段
element.addEventListener("click", handler, true); // 捕獲
element.addEventListener("click", handler, false); // 冒泡（默認）

// 推薦用 options 對象寫法，更清晰
element.addEventListener("click", handler, { capture: true });
```

## 阻止冒泡

```javascript
document.getElementById("child").addEventListener("click", (e) => {
  e.stopPropagation(); // 阻止事件繼續冒泡
  // e.stopImmediatePropagation()  // 還阻止同元素上的其他監聽器
});
```

## 事件委託

不在每個子元素上綁定事件，而是在父元素統一處理，利用冒泡：

```javascript
// 不好的做法：給每個 li 綁定事件（內存消耗大，動態添加的元素無效）
document.querySelectorAll("li").forEach((li) => {
  li.addEventListener("click", handleItemClick);
});

// 好的做法：委託給父元素
document.getElementById("list").addEventListener("click", (e) => {
  const li = e.target.closest("li"); // closest 向上找最近的 li
  if (!li) return;

  const id = li.dataset.id;
  handleItemClick(id);
});

// 動態添加的 li 也能響應事件 ✅
const newLi = document.createElement("li");
newLi.dataset.id = "100";
newLi.textContent = "新項目";
document.getElementById("list").appendChild(newLi);
```

## e.target vs e.currentTarget

```javascript
document.getElementById("parent").addEventListener("click", (e) => {
  console.log(e.target); // 實際觸發事件的元素（可能是子元素）
  console.log(e.currentTarget); // 綁定監聽器的元素（parent）
});
```

## 常用鼠標事件

```javascript
element.addEventListener("mouseenter", () => {}); // 進入元素，不冒泡
element.addEventListener("mouseleave", () => {}); // 離開元素，不冒泡
element.addEventListener("mouseover", () => {}); // 進入元素或子元素，會冒泡
element.addEventListener("mouseout", () => {}); // 離開元素或子元素，會冒泡
```

`mouseenter` / `mouseleave` 不會在經過子元素時觸發，通常更好用。

## 常用鍵盤事件

```javascript
document.addEventListener("keydown", (e) => {
  console.log(e.key); // 'Enter', 'Escape', 'ArrowUp' 等
  console.log(e.code); // 'KeyA', 'Digit1' 等（物理鍵）
  console.log(e.keyCode); // 已廢棄，用 e.key

  // 組合鍵
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

## 自定義事件

```javascript
// 創建和派發自定義事件
const event = new CustomEvent("user:login", {
  bubbles: true,
  cancelable: true,
  detail: { userId: 123, username: "Alice" },
});

document.dispatchEvent(event);

// 監聽自定義事件
document.addEventListener("user:login", (e) => {
  console.log(e.detail.username); // 'Alice'
});
```

在 Vue 裏可以用這個方式做跨組件通信（雖然 Vuex 更適合）。

## 防抖：頻繁觸發只執行最後一次

```javascript
// scroll/resize/input 等高頻事件需要防抖
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
    console.log("resize 結束後才執行");
  }, 300),
);
```

## 事件監聽器的清除

```javascript
// 常見內存泄漏：綁了事件但沒有清除
class Component {
  handleClick = () => {};

  mount() {
    document.addEventListener("click", this.handleClick);
  }

  destroy() {
    // 必須清除！否則組件已銷燬，監聽器還在
    document.removeEventListener("click", this.handleClick);
  }
}

// 使用 AbortController（新方式，更優雅）
const controller = new AbortController();
document.addEventListener("click", handler, { signal: controller.signal });

// 清除時
controller.abort(); // 移除所有用該 signal 綁定的監聽器
```

## 小結

- 事件經過捕獲 → 目標 → 冒泡三個階段
- 事件委託利用冒泡，減少事件綁定，支持動態元素
- `e.target` 是觸發元素，`e.currentTarget` 是綁定監聽的元素
- `mouseenter` / `mouseleave` 不冒泡，通常比 `mouseover` / `mouseout` 好用
- 記得在組件銷燬時清除事件監聽，防止內存泄漏
