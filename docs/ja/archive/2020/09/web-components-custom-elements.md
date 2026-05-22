---
title: "Web Components：Custom ElementsとShadow DOMの実践"
date: 2020-09-30 14:45:02
tags:
  - TypeScript
readingTime: 3
description: "Web Components はブラウザネイティブのコンポーネント化手法であり、フレームワークを必要とせずに再利用可能なカスタム HTML 要素を作成できます。2020 年時点で全ての主要ブラウザがサポートしており、今が深く学ぶ絶好のタイミングです。"
wordCount: 551
---

Web Components はブラウザネイティブのコンポーネント化手法であり、フレームワークを必要とせずに再利用可能なカスタム HTML 要素を作成できます。2020 年時点で全ての主要ブラウザがサポートしており、今が深く学ぶ絶好のタイミングです。

## 三つのコア API

```
Web Components = Custom Elements + Shadow DOM + HTML Templates
```

- **Custom Elements**：カスタム HTML タグを定義します（`<my-button>`）
- **Shadow DOM**：隔離された DOM サブツリーで、スタイルが外部に漏れず、外部の影響も受けません
- **HTML Templates**：`<template>` タグ、遅延解析されるテンプレート

## 最初の Custom Element を作成する

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

Vue の `<slot>` や Angular の `<ng-content>` と似ています：

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

Custom Elements はどのフレームワークにもシームレスに組み込めます：

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

**適しているケース**：

- フレームワーク間で UI コンポーネントを共有する（デザインシステム）
- 厳格なスタイルの隔離が必要なコンポーネント（サードパーティ埋め込み）
- 特定のフレームワークに縛られたくないコンポーネントライブラリ

**適さないケース**：

- 純粋な React/Vue/Angular プロジェクト（フレームワーク自身のコンポーネントシステムを使う方が便利）
- TypeScript の強力な型サポートが必要な場合（Web Components のネイティブ TypeScript サポートは弱い）

## まとめ

Web Components の価値は**フレームワーク非依存性**にあります。Adobe Spectrum や IBM Carbon など、多くのデザインシステムが Web Components 版を提供し始めています。普段 Angular や React のフレームワーク内で作業している場合でも、Web Components を理解することで、より汎用的なコンポーネントの境界を設計するのに役立ちます。
