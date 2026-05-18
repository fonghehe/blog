---
title: "Web Components：Custom Elements 與 Shadow DOM 實戰"
date: 2020-09-30 14:45:02
tags:
  - TypeScript
readingTime: 2
description: "Web Components 是瀏覽器原生的元件化方案，無需任何框架即可建立可複用的自定義 HTML 元素。2020 年所有主流瀏覽器均已支援，現在是深入瞭解它的好時機。"
---

Web Components 是瀏覽器原生的元件化方案，無需任何框架即可建立可複用的自定義 HTML 元素。2020 年所有主流瀏覽器均已支援，現在是深入瞭解它的好時機。

## 三個核心 API

```
Web Components = Custom Elements + Shadow DOM + HTML Templates
```

- **Custom Elements**：定義自定義 HTML 標籤（`<my-button>`）
- **Shadow DOM**：隔離的 DOM 子樹，樣式不外洩、不受外部影響
- **HTML Templates**：`<template>` 標籤，惰性解析的模板

## 建立第一個 Custom Element

```javascript
class UserCard extends HTMLElement {
  constructor() {
    super();
    // 建立 Shadow DOM
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
      <button>關注</button>
    `;
  }

  // 監聽的 attribute 列表
  static get observedAttributes() {
    return ["name", "email"];
  }

  // attribute 變化時觸發
  attributeChangedCallback(name, oldValue, newValue) {
    const shadow = this.shadowRoot;
    if (name === "name") {
      shadow.querySelector(".name").textContent = newValue;
    }
    if (name === "email") {
      shadow.querySelector(".email").textContent = newValue;
    }
  }

  // 生命週期：插入 DOM
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
    console.log("關注了：", e.detail.name);
  });
</script>
```

## Slots：內容投影

類似 Vue 的 `<slot>` 或 Angular 的 `<ng-content>`：

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
          <slot name="title">預設標題</slot>
        </div>
        <slot></slot>  <!-- 預設 slot -->
      </div>
    `;
  }
}

customElements.define("my-card", MyCard);
```

```html
<my-card>
  <h2 slot="title">自定義標題</h2>
  <p>這是正文內容，進入預設 slot</p>
</my-card>
```

## 與框架整合

Custom Elements 可以無縫嵌入任何框架：

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

## 何時選擇 Web Components

**適合**：

- 跨框架共享 UI 元件（設計系統）
- 需要嚴格樣式隔離的元件（第三方嵌入）
- 不想繫結特定框架的元件庫

**不太適合**：

- 純 React/Vue/Angular 專案（用框架自身的元件系統更方便）
- 需要 TypeScript 強型別支援（Web Components 原生 TS 支援較弱）

## 總結

Web Components 的價值在於**框架無關性**。越來越多的設計系統（如 Adobe Spectrum、IBM Carbon）開始提供 Web Components 版本。即使你的日常工作在 Angular 或 React 框架內，理解 Web Components 也有助於你設計更通用的元件邊界。
