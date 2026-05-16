---
title: "Web Components in Practice: Custom Elements"
date: 2019-04-20 10:14:16
tags:
  - TypeScript
readingTime: 1
description: "Web Components are now a W3C standard, supported natively in Chrome and Firefox. They enable component-based development without relying on any framework."
---

Web Components are now a W3C standard, supported natively in Chrome and Firefox. They enable component-based development without relying on any framework.

## Four Core APIs

1. **Custom Elements**: define custom HTML elements
2. **Shadow DOM**: isolate styles and DOM
3. **HTML Templates**: reusable HTML templates
4. **ES Modules**: modularization (already a standard)

## Defining a Custom Element

```javascript
// my-button.js
class MyButton extends HTMLElement {
  // Attributes to observe (attributeChangedCallback fires on changes)
  static get observedAttributes() {
    return ["type", "disabled", "loading"];
  }

  constructor() {
    super();

    // Create Shadow DOM
    this.attachShadow({ mode: "open" });

    // Initialize
    this.render();
  }

  connectedCallback() {
    // Called when the element is inserted into the DOM
    this.shadowRoot
      .querySelector("button")
      .addEventListener("click", this._handleClick);
  }

  disconnectedCallback() {
    // Called when the element is removed from the DOM (clean up events)
    this.shadowRoot
      .querySelector("button")
      .removeEventListener("click", this._handleClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Re-render when attributes change
    this.render();
  }

  _handleClick = (e) => {
    if (this.hasAttribute("disabled")) {
      e.preventDefault();
      return;
    }
    // Dispatch a custom event
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
        ${loading ? "Loading..." : "<slot></slot>"}
      </button>
    `;
  }
}

customElements.define("my-button", MyButton);
```

Web Components have good browser support today and are a solid choice for building UI libraries that work across frameworks.
