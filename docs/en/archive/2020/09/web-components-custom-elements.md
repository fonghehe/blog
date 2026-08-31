---
title: "Web Components: Custom Elements and Shadow DOM in Practice"
date: 2020-09-30 14:45:02
tags:
  - TypeScript
readingTime: 2
description: "A practical guide to Web Components, the browser-native approach to creating reusable custom HTML elements without any framework, now supported across all major browsers."
wordCount: 205
---

Web Components are the browser's native componentization approach — you can create reusable custom HTML elements without any framework. By 2020 all major browsers support them, so now is a good time to dig in.

## The Three Core APIs

```
Web Components = Custom Elements + Shadow DOM + HTML Templates
```

- **Custom Elements**: define custom HTML tags (`<my-button>`)
- **Shadow DOM**: an isolated DOM subtree whose styles don't leak out and aren't affected from outside
- **HTML Templates**: the `<template>` tag, a lazily parsed template

## Creating Your First Custom Element

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

## Slots: Content Projection

Similar to Vue's `<slot>` or Angular's `<ng-content>`:

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

## Integrating with Frameworks

Custom Elements can be embedded seamlessly into any framework:

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

## When to Choose Web Components

**Good fits:**

- Sharing UI components across frameworks (design systems)
- Components that need strict style isolation (third-party embeds)
- Component libraries that don't want to be tied to a specific framework

**Less suitable:**

- Pure React/Vue/Angular projects (the framework's own component system is more convenient)
- Cases needing strong TypeScript typing (Web Components' native TS support is weak)

## Summary

The value of Web Components lies in their **framework independence**. More and more design systems (such as Adobe Spectrum and IBM Carbon) are shipping Web Components versions. Even if your day-to-day work stays inside Angular or React, understanding Web Components helps you design more universal component boundaries.
