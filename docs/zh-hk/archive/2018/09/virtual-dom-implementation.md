---
title: "從零實現一個簡單的 Virtual DOM"
date: 2018-09-19 11:22:09
tags:
  - 前端
readingTime: 3
description: "Virtual DOM 是 React 和 Vue 2 的核心概念。看了很多文章，感覺還是自己動手實現一遍才真正理解。這篇文章用幾百行代碼實現一個最簡版本的 VDOM。"
---

Virtual DOM 是 React 和 Vue 2 的核心概念。看了很多文章，感覺還是自己動手實現一遍才真正理解。這篇文章用幾百行代碼實現一個最簡版本的 VDOM。

## 為什麼需要 Virtual DOM

直接操作 DOM 太慢了嗎？其實不完全是。真正的問題是：

1. 直接操作 DOM，需要手動追蹤狀態變化，代碼複雜
2. 全量更新 DOM 確實慢，但 VDOM 的價值在於**跨平台**和**聲明式 UI**

Virtual DOM 是 JS 對象描述的"虛擬"DOM 樹，更新時對比新舊 VDOM（diff），只把差異應用到真實 DOM（patch）。

## 第一步：定義 VNode 結構

```javascript
// VNode：描述一個 DOM 節點
// h('div', { class: 'container' }, [h('p', null, 'Hello')])
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children
      .flat()
      .map((child) =>
        typeof child === "string" ? { type: "TEXT_NODE", value: child } : child,
      ),
  };
}
```

## 第二步：VNode 轉真實 DOM（mount）

```javascript
function createElement(vnode) {
  // 文本節點
  if (vnode.type === "TEXT_NODE") {
    return document.createTextNode(vnode.value);
  }

  // 元素節點
  const el = document.createElement(vnode.type);

  // 設置屬性
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith("on")) {
      // 事件監聽
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // 遞歸創建子節點
  vnode.children.forEach((child) => {
    el.appendChild(createElement(child));
  });

  // 保存對應的 DOM 元素，patch 時用
  vnode._el = el;

  return el;
}

// 首次掛載
function mount(vnode, container) {
  const el = createElement(vnode);
  container.appendChild(el);
}
```

## 第三步：diff 算法

這是最核心的部分，比較新舊 VNode 找出差異：

```javascript
function diff(oldVNode, newVNode) {
  // 類型不同：直接替換
  if (oldVNode.type !== newVNode.type) {
    const newEl = createElement(newVNode);
    oldVNode._el.parentNode.replaceChild(newEl, oldVNode._el);
    return;
  }

  // 文本節點：更新文本
  if (newVNode.type === "TEXT_NODE") {
    if (oldVNode.value !== newVNode.value) {
      oldVNode._el.nodeValue = newVNode.value;
    }
    newVNode._el = oldVNode._el;
    return;
  }

  // 同類型元素：複用 DOM，更新屬性和子節點
  const el = (newVNode._el = oldVNode._el);

  patchProps(el, oldVNode.props, newVNode.props);
  patchChildren(el, oldVNode.children, newVNode.children);
}

function patchProps(el, oldProps, newProps) {
  // 刪除舊屬性
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // 設置新屬性
  for (const [key, value] of Object.entries(newProps)) {
    if (oldProps[key] !== value) {
      if (key.startsWith("on")) {
        if (oldProps[key]) {
          el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
        }
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        el.setAttribute(key, value);
      }
    }
  }
}

function patchChildren(el, oldChildren, newChildren) {
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    if (!oldChildren[i]) {
      // 新增節點
      el.appendChild(createElement(newChildren[i]));
    } else if (!newChildren[i]) {
      // 刪除節點
      el.removeChild(oldChildren[i]._el);
    } else {
      // 更新節點
      diff(oldChildren[i], newChildren[i]);
    }
  }
}
```

## 第四步：簡單的響應式

把 VDOM 和狀態更新結合起來：

```javascript
let currentVNode = null;
let container = null;

function render(vnode, mountPoint) {
  if (!currentVNode) {
    // 首次渲染
    mount(vnode, mountPoint);
    container = mountPoint;
  } else {
    // 更新
    diff(currentVNode, vnode);
  }
  currentVNode = vnode;
}

// 簡單的應用
let state = { count: 0 };

function view(state) {
  return h(
    "div",
    { class: "app" },
    h("p", null, `Count: ${state.count}`),
    h("button", { onClick: increment }, "+1"),
    h("button", { onClick: decrement }, "-1"),
  );
}

function increment() {
  state = { ...state, count: state.count + 1 };
  render(view(state), document.getElementById("app"));
}

function decrement() {
  state = { ...state, count: state.count - 1 };
  render(view(state), document.getElementById("app"));
}

// 初始渲染
render(view(state), document.getElementById("app"));
```

## 真正的 diff 有多複雜

我們這個版本的 patchChildren 是最簡單的順序比較，有很多問題：

```
舊：[A, B, C, D]
新：[A, C, B, D]  // 僅僅調換了 B 和 C 的順序
```

簡單版本會更新 B、C 兩個節點，但實際上只需要移動 C（或 B）即可。

真正的實現（如 Vue 2 的雙端比較、Vue 3 的最長遞增子序列）需要 `key` 來識別節點身份，然後用更高效的算法找到最少的移動次數。這是 VDOM 實現裏最複雜的部分。

## 小結

- VNode 是 JS 對象描述的虛擬 DOM 節點
- mount：VNode → 真實 DOM
- diff：比較新舊 VNode，找差異
- patch：把差異應用到真實 DOM
- 完整實現還需要處理 key、組件、異步更新隊列等
