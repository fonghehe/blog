---
title: "Web Components実践：カスタム要素"
date: 2019-04-20 10:14:16
tags:
  - TypeScript
readingTime: 1
description: "Web ComponentsはすでにW3C標準となっており、ChromeとFirefoxでネイティブサポートされています。フレームワークに依存せず、ネイティブブラウザでコンポーネント化を実現できます。"
wordCount: 187
---

Web ComponentsはすでにW3C標準となっており、ChromeとFirefoxでネイティブサポートされています。フレームワークに依存せず、ネイティブブラウザでコンポーネント化を実現できます。

## 4つのコアAPI

1. **Custom Elements**：カスタムHTML要素の定義
2. **Shadow DOM**：スタイルとDOMの分離
3. **HTML Templates**：再利用可能なHTMLテンプレート
4. **ES Modules**：モジュール化（すでに標準）

## カスタム要素の定義

```javascript
// my-button.js
class MyButton extends HTMLElement {
  // 監視する属性（変化時にattributeChangedCallbackが呼ばれる）
  static get observedAttributes() {
    return ["type", "disabled", "loading"];
  }

  constructor() {
    super();

    // Shadow DOMを作成
    this.attachShadow({ mode: "open" });

    // 初期化
    this.render();
  }

  connectedCallback() {
    // 要素がDOMに挿入されたときに呼ばれる
    this.shadowRoot
      .querySelector("button")
      .addEventListener("click", this._handleClick);
  }

  disconnectedCallback() {
    // 要素がDOMから削除されたときに呼ばれる（イベントのクリーンアップ）
    this.shadowRoot
      .querySelector("button")
      .removeEventListener("click", this._handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // 属性変化時に再レンダリング
    this.render();
  }

  _handleClick = (e) => {
    if (this.hasAttribute("disabled")) {
      e.preventDefault();
      return;
    }
    // カスタムイベントをディスパッチ
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
      </style>
      <button ${disabled ? "disabled" : ""}>
        ${loading ? "読み込み中..." : "<slot></slot>"}
      </button>
    `;
  }
}

customElements.define("my-button", MyButton);
```

Web Componentsは現在ブラウザサポートが充実しており、フレームワーク間で動作するUIライブラリを構築する際の確かな選択肢です。
