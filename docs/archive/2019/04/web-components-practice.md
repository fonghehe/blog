---
title: "Web Components 实践：自定义元素"
date: 2019-04-20 10:14:16
tags:
  - TypeScript
readingTime: 2
description: "Web Components 已经是 W3C 标准了，Chrome、Firefox 都支持。不依赖任何框架，原生浏览器实现组件化。"
wordCount: 236
---

Web Components 已经是 W3C 标准了，Chrome、Firefox 都支持。不依赖任何框架，原生浏览器实现组件化。

## 四个核心 API

1. **Custom Elements**：定义自定义 HTML 元素
2. **Shadow DOM**：样式和 DOM 隔离
3. **HTML Templates**：可复用的 HTML 模板
4. **ES Modules**：模块化（已经是标准了）

## 定义自定义元素

```javascript
// my-button.js
class MyButton extends HTMLElement {
  // 观察的属性（变化时会调用 attributeChangedCallback）
  static get observedAttributes() {
    return ["type", "disabled", "loading"];
  }

  constructor() {
    super();

    // 创建 Shadow DOM
    this.attachShadow({ mode: "open" });

    // 初始化
    this.render();
  }

  connectedCallback() {
    // 元素插入 DOM 时调用
    this.shadowRoot
      .querySelector("button")
      .addEventListener("click", this._handleClick);
  }

  disconnectedCallback() {
    // 元素从 DOM 移除时调用（清理事件）
    this.shadowRoot
      .querySelector("button")
      .removeEventListener("click", this._handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // 属性变化时重新渲染
    this.render();
  }

  _handleClick = (e) => {
    if (this.hasAttribute("disabled")) {
      e.preventDefault();
      return;
    }
    // 派发自定义事件
    this.dispatchEvent(new CustomEvent("my-click", { bubbles: true }));
  };

  render() {
    const type = this.getAttribute("type") || "default";
    const disabled = this.hasAttribute("disabled");
    const loading = this.hasAttribute("loading");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; }
        button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background: ${type === "primary" ? "#409eff" : "#fff"};
          color: ${type === "primary" ? "#fff" : "#333"};
        }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
      <button ${disabled ? "disabled" : ""}>
        ${loading ? '<span class="spinner"></span>' : ""}
        <slot></slot>
      </button>
    `;
  }
}

// 注册自定义元素（必须包含连字符）
customElements.define("my-button", MyButton);
```

```html
<!-- 使用 -->
<my-button type="primary" @my-click="handleClick">点击</my-button>
<my-button disabled>禁用</my-button>
```

## HTML Templates

```html
<template id="user-card-template">
  <style>
    .card {
      border: 1px solid #eee;
      padding: 16px;
      border-radius: 8px;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
    }
  </style>
  <div class="card">
    <img class="avatar" />
    <div class="name"></div>
    <div class="bio"></div>
  </div>
</template>

<script>
  class UserCard extends HTMLElement {
    connectedCallback() {
      const template = document.getElementById("user-card-template");
      const clone = template.content.cloneNode(true);

      clone.querySelector(".avatar").src = this.getAttribute("avatar");
      clone.querySelector(".name").textContent = this.getAttribute("name");
      clone.querySelector(".bio").textContent = this.getAttribute("bio");

      this.attachShadow({ mode: "open" }).appendChild(clone);
    }
  }

  customElements.define("user-card", UserCard);
</script>
```

## 在 Vue/React 中使用 Web Components

```javascript
// Vue 中使用（忽略自定义元素的 Vue 警告）
// vue.config.js
module.exports = {
  chainWebpack: (config) => {
    config.module
      .rule("vue")
      .use("vue-loader")
      .tap((options) => {
        options.compilerOptions = {
          isCustomElement: (tag) => tag.startsWith("my-"),
        };
        return options;
      });
  },
};
```

```jsx
// React 中直接用，属性用 camelCase
function App() {
  return (
    <my-button type="primary" onMyClick={handleClick}>
      点击
    </my-button>
  );
}
```

## 2019 年的现状

Web Components 的问题：

- Safari 14 才完整支持（2020），现在 iOS 支持不完整
- 开发体验比 Vue/React 差得多（没有完善的状态管理）
- Lit-element（Google）、Stencil 等库在改善开发体验

适合场景：设计系统的底层组件（供多个框架使用），不适合直接开发应用。

## 小结

- Web Components = Custom Elements + Shadow DOM + Templates
- Shadow DOM 实现真正的样式隔离
- 适合跨框架的 UI 组件库，不适合直接用来开发应用
- 生产使用建议配合 Lit-element 或 Stencil
