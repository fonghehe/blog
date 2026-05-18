---
title: "Web Components 實踐：自定義元素"
date: 2019-04-20 10:14:16
tags:
  - TypeScript
readingTime: 2
description: "Web Components 已經是 W3C 標準了，Chrome、Firefox 都支持。不依賴任何框架，原生瀏覽器實現組件化。"
---

Web Components 已經是 W3C 標準了，Chrome、Firefox 都支持。不依賴任何框架，原生瀏覽器實現組件化。

## 四個核心 API

1. **Custom Elements**：定義自定義 HTML 元素
2. **Shadow DOM**：樣式和 DOM 隔離
3. **HTML Templates**：可複用的 HTML 模板
4. **ES Modules**：模塊化（已經是標準了）

## 定義自定義元素

```javascript
// my-button.js
class MyButton extends HTMLElement {
  // 觀察的屬性（變化時會調用 attributeChangedCallback）
  static get observedAttributes() {
    return ["type", "disabled", "loading"];
  }

  constructor() {
    super();

    // 創建 Shadow DOM
    this.attachShadow({ mode: "open" });

    // 初始化
    this.render();
  }

  connectedCallback() {
    // 元素插入 DOM 時調用
    this.shadowRoot
      .querySelector("button")
      .addEventListener("click", this._handleClick);
  }

  disconnectedCallback() {
    // 元素從 DOM 移除時調用（清理事件）
    this.shadowRoot
      .querySelector("button")
      .removeEventListener("click", this._handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // 屬性變化時重新渲染
    this.render();
  }

  _handleClick = (e) => {
    if (this.hasAttribute("disabled")) {
      e.preventDefault();
      return;
    }
    // 派發自定義事件
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

// 註冊自定義元素（必須包含連字符）
customElements.define("my-button", MyButton);
```

```html
<!-- 使用 -->
<my-button type="primary" @my-click="handleClick">點擊</my-button>
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
// Vue 中使用（忽略自定義元素的 Vue 警告）
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
// React 中直接用，屬性用 camelCase
function App() {
  return (
    <my-button type="primary" onMyClick={handleClick}>
      點擊
    </my-button>
  );
}
```

## 2019 年的現狀

Web Components 的問題：

- Safari 14 才完整支持（2020），現在 iOS 支持不完整
- 開發體驗比 Vue/React 差得多（沒有完善的狀態管理）
- Lit-element（Google）、Stencil 等庫在改善開發體驗

適合場景：設計系統的底層組件（供多個框架使用），不適合直接開發應用。

## 小結

- Web Components = Custom Elements + Shadow DOM + Templates
- Shadow DOM 實現真正的樣式隔離
- 適合跨框架的 UI 組件庫，不適合直接用來開發應用
- 生產使用建議配合 Lit-element 或 Stencil
