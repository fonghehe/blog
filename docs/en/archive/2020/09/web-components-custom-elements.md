---
title: "Web Components: Custom Elements and Shadow DOM in Practice"
date: 2020-09-30 14:45:02
tags:
  - TypeScript
readingTime: 2
description: "Web Components 是浏览器原生的组件化方案，无需任何框架即可创建可复用的自定义 HTML 元素。2020 年所有主流浏览器均已支持，现在是深入了解它的好时机。"
---

Web Components 是浏览器原生的组件化方案，无需任何框架即可创建可复用的自定义 HTML 元素。2020 年所有主流浏览器均已支持，现在是深入了解它的好时机。

## 三个核心 API

```
Web Components = Custom Elements + Shadow DOM + HTML Templates
```

- **Custom Elements**：定义自定义 HTML 标签（`<my-button>`）
- **Shadow DOM**：隔离的 DOM 子树，样式不外泄、不受外部影响
- **HTML Templates**：`<template>` 标签，惰性解析的模板

## 创建第一个 Custom Element

```javascript
class UserCard extends HTMLElement {
  constructor() {
    super();
    // 创建 Shadow DOM
    const shadow = this.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          font-family: sans-serif;
        }
        .name { font-size: 18px; font-weight: bold; }
        .email { color: #666; font-size: 14px; }
        button {
          background: #0066ff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
        }
      </style>
      <div class="name"></div>
      <div class="email"></div>
      <button>关注</button>
    `;
  }

  // 监听的 attribute 列表
  static get observedAttributes() {
    return ["name", "email"];
  }

  // attribute 变化时触发
  attributeChangedCallback(name, oldValue, newValue) {
    const shadow = this.shadowRoot;
    if (name === "name") {
      shadow.querySelector(".name").textContent = newValue;
    }
    if (name === "email") {
      shadow.querySelector(".email").textContent = newValue;
    }
  }

  // 生命周期：插入 DOM
  connectedCallback() {
    this.shadowRoot.querySelector("button").addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("follow", {
          detail: { name: this.getAttribute("name") },
          bubbles: true,
        }),
      );
    });
  }
}

customElements.define("user-card", UserCard);
```

```html
<!-- 使用 -->
<user-card name="Alice" email="alice@example.com"></user-card>

<script>
  document.querySelector("user-card").addEventListener("follow", (e) => {
    console.log("关注了：", e.detail.name);
  });
</script>
```

## Slots：内容投影

类似 Vue 的 `<slot>` 或 Angular 的 `<ng-content>`：

```javascript
class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        .card { border: 1px solid #eee; padding: 16px; }
        .header { background: #f5f5f5; padding: 8px; }
      </style>
      <div class="card">
        <div class="header">
          <slot name="title">默认标题</slot>
        </div>
        <slot></slot>  <!-- 默认 slot -->
      </div>
    `;
  }
}

customElements.define("my-card", MyCard);
```

```html
<my-card>
  <h2 slot="title">自定义标题</h2>
  <p>这是正文内容，进入默认 slot</p>
</my-card>
```

## 与框架集成

Custom Elements 可以无缝嵌入任何框架：

```jsx
// React 中使用
function App() {
  return (
    <user-card
      name="Alice"
      email="alice@example.com"
      onFollow={(e) => console.log(e.detail)}
    />
  );
}
```

```html
<!-- Vue 中使用 -->
<user-card :name="user.name" :email="user.email" @follow="handleFollow" />
```

## 何时选择 Web Components

**适合**：

- 跨框架共享 UI 组件（设计系统）
- 需要严格样式隔离的组件（第三方嵌入）
- 不想绑定特定框架的组件库

**不太适合**：

- 纯 React/Vue/Angular 项目（用框架自身的组件系统更方便）
- 需要 TypeScript 强类型支持（Web Components 原生 TS 支持较弱）

## Summary

Web Components 的价值在于**框架无关性**。越来越多的设计系统（如 Adobe Spectrum、IBM Carbon）开始提供 Web Components 版本。即使你的日常工作在 Angular 或 React 框架内，理解 Web Components 也有助于你设计更通用的组件边界。
