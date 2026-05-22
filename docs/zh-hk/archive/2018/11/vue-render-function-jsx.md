---
title: "Vue render 函數與 JSX：落地路徑與實戰建議"
date: 2018-11-20 11:14:48
tags:
  - Vue
readingTime: 2
description: "大多數時候範本夠用，但有些場景 render 函數更靈活。"
wordCount: 227
---

大多數時候模板夠用，但有些場景 render 函數更靈活。

## 為什麼需要 render 函數

模板有侷限——不能根據 props 動態生成不同的標籤：

```javascript
// ❌ 模板裏做不了這個（不能根據 prop 動態指定標籤名）
// <component :is="level">  // 能用，但如果標籤名邏輯複雜就麻煩了

// ✅ render 函數完全用 JS 控製
export default {
  props: {
    level: { type: Number, required: true },
  },
  render(h) {
    return h("h" + this.level, this.$slots.default);
  },
};
// <Heading :level="2">標題</Heading> → <h2>標題</h2>
```

## createElement（h）的參數

```javascript
h(
  // 1. 標籤名、組件選項對象或異步函數
  "div",

  // 2. 數據對象（可選）
  {
    class: { active: true, disabled: false },
    style: { color: "red", fontSize: "14px" },
    attrs: { id: "app", "data-id": "123" },
    props: { value: "hello" },
    on: { click: this.handleClick },
    // 原生事件（組件）
    nativeOn: { click: this.handleNativeClick },
  },

  // 3. 子節點（可選）
  ["text content", h("span", "child")],
);
```

## 實戰：動態表單

根據配置生成不同類型的表單項：

```javascript
const FormField = {
  props: {
    type: String, // 'input' | 'select' | 'textarea'
    value: [String, Number],
    options: Array, // select 選項
  },
  render(h) {
    if (this.type === "select") {
      return h(
        "select",
        {
          on: { change: (e) => this.$emit("input", e.target.value) },
        },
        this.options.map((opt) =>
          h("option", { attrs: { value: opt.value } }, opt.label),
        ),
      );
    }

    if (this.type === "textarea") {
      return h("textarea", {
        attrs: { value: this.value },
        on: { input: (e) => this.$emit("input", e.target.value) },
      });
    }

    return h("input", {
      attrs: { type: this.type || "text", value: this.value },
      on: { input: (e) => this.$emit("input", e.target.value) },
    });
  },
};
```

## JSX：更易讀的 render 函數

配置 Babel JSX 插件後，可以用 JSX 替代 h 調用：

```bash
npm install --save-dev @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props
```

```javascript
// 和上面等價的 JSX 寫法
export default {
  props: { level: Number },
  render() {
    const Tag = `h${this.level}`
    return <Tag>{this.$slots.default}</Tag>
  }
}

// 更復雜的例子
export default {
  render() {
    return (
      <div class="container">
        <header>
          <h1>{this.title}</h1>
        </header>
        <ul>
          {this.items.map(item => (
            <li key={item.id} onClick={() => this.select(item)}>
              {item.name}
            </li>
          ))}
        </ul>
      </div>
    )
  }
}
```

## 範本 vs render 函數的選擇

- **模板**：大多數場景，直觀可讀，工具支持好
- **render 函數**：需要完整 JS 能力的場景（動態標籤、複雜循環邏輯）
- **JSX**：習慣 React 開發模式，或組件主要是邏輯而非展示

## 小結

- `render` 函數接收 `h`（createElement），返回 VNode
- 模板最終也編譯為 render 函數
- JSX 是 render 函數的語法糖，需要 Babel 外掛
- 優先用範本，需要動態性時再用 render/JSX
