---
title: "从零实现一个简单的 Virtual DOM"
date: 2018-09-19 11:22:09
tags:
  - 前端
---

Virtual DOM 是 React 和 Vue 2 的核心概念。看了很多文章，感觉还是自己动手实现一遍才真正理解。这篇文章用几百行代码实现一个最简版本的 VDOM。

## 为什么需要 Virtual DOM

直接操作 DOM 太慢了吗？其实不完全是。真正的问题是：

1. 直接操作 DOM，需要手动追踪状态变化，代码复杂
2. 全量更新 DOM 确实慢，但 VDOM 的价值在于**跨平台**和**声明式 UI**

Virtual DOM 是 JS 对象描述的"虚拟"DOM 树，更新时对比新旧 VDOM（diff），只把差异应用到真实 DOM（patch）。

## 第一步：定义 VNode 结构

```javascript
// VNode：描述一个 DOM 节点
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

## 第二步：VNode 转真实 DOM（mount）

```javascript
function createElement(vnode) {
  // 文本节点
  if (vnode.type === "TEXT_NODE") {
    return document.createTextNode(vnode.value);
  }

  // 元素节点
  const el = document.createElement(vnode.type);

  // 设置属性
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith("on")) {
      // 事件监听
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // 递归创建子节点
  vnode.children.forEach((child) => {
    el.appendChild(createElement(child));
  });

  // 保存对应的 DOM 元素，patch 时用
  vnode._el = el;

  return el;
}

// 首次挂载
function mount(vnode, container) {
  const el = createElement(vnode);
  container.appendChild(el);
}
```

## 第三步：diff 算法

这是最核心的部分，比较新旧 VNode 找出差异：

```javascript
function diff(oldVNode, newVNode) {
  // 类型不同：直接替换
  if (oldVNode.type !== newVNode.type) {
    const newEl = createElement(newVNode);
    oldVNode._el.parentNode.replaceChild(newEl, oldVNode._el);
    return;
  }

  // 文本节点：更新文本
  if (newVNode.type === "TEXT_NODE") {
    if (oldVNode.value !== newVNode.value) {
      oldVNode._el.nodeValue = newVNode.value;
    }
    newVNode._el = oldVNode._el;
    return;
  }

  // 同类型元素：复用 DOM，更新属性和子节点
  const el = (newVNode._el = oldVNode._el);

  patchProps(el, oldVNode.props, newVNode.props);
  patchChildren(el, oldVNode.children, newVNode.children);
}

function patchProps(el, oldProps, newProps) {
  // 删除旧属性
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // 设置新属性
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
      // 新增节点
      el.appendChild(createElement(newChildren[i]));
    } else if (!newChildren[i]) {
      // 删除节点
      el.removeChild(oldChildren[i]._el);
    } else {
      // 更新节点
      diff(oldChildren[i], newChildren[i]);
    }
  }
}
```

## 第四步：简单的响应式

把 VDOM 和状态更新结合起来：

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

// 简单的应用
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

## 真正的 diff 有多复杂

我们这个版本的 patchChildren 是最简单的顺序比较，有很多问题：

```
旧：[A, B, C, D]
新：[A, C, B, D]  // 仅仅调换了 B 和 C 的顺序
```

简单版本会更新 B、C 两个节点，但实际上只需要移动 C（或 B）即可。

真正的实现（如 Vue 2 的双端比较、Vue 3 的最长递增子序列）需要 `key` 来识别节点身份，然后用更高效的算法找到最少的移动次数。这是 VDOM 实现里最复杂的部分。

## 小结

- VNode 是 JS 对象描述的虚拟 DOM 节点
- mount：VNode → 真实 DOM
- diff：比较新旧 VNode，找差异
- patch：把差异应用到真实 DOM
- 完整实现还需要处理 key、组件、异步更新队列等
