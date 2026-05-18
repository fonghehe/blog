---
title: "Vue render 函数与 JSX"
date: 2018-11-20 11:14:48
tags:
  - Vue
readingTime: 2
description: "大多数时候模板够用，但有些场景 render 函数更灵活。"
---

大多数时候模板够用，但有些场景 render 函数更灵活。

## 为什么需要 render 函数

模板有局限——不能根据 props 动态生成不同的标签：

```javascript
// ❌ 模板里做不了这个（不能根据 prop 动态指定标签名）
// <component :is="level">  // 能用，但如果标签名逻辑复杂就麻烦了

// ✅ render 函数完全用 JS 控制
export default {
  props: {
    level: { type: Number, required: true },
  },
  render(h) {
    return h("h" + this.level, this.$slots.default);
  },
};
// <Heading :level="2">标题</Heading> → <h2>标题</h2>
```

## createElement（h）的参数

```javascript
h(
  // 1. 标签名、组件选项对象或异步函数
  "div",

  // 2. 数据对象（可选）
  {
    class: { active: true, disabled: false },
    style: { color: "red", fontSize: "14px" },
    attrs: { id: "app", "data-id": "123" },
    props: { value: "hello" },
    on: { click: this.handleClick },
    // 原生事件（组件）
    nativeOn: { click: this.handleNativeClick },
  },

  // 3. 子节点（可选）
  ["text content", h("span", "child")],
);
```

## 实战：动态表单

根据配置生成不同类型的表单项：

```javascript
const FormField = {
  props: {
    type: String, // 'input' | 'select' | 'textarea'
    value: [String, Number],
    options: Array, // select 选项
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

## JSX：更易读的 render 函数

配置 Babel JSX 插件后，可以用 JSX 替代 h 调用：

```bash
npm install --save-dev @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props
```

```javascript
// 和上面等价的 JSX 写法
export default {
  props: { level: Number },
  render() {
    const Tag = `h${this.level}`
    return <Tag>{this.$slots.default}</Tag>
  }
}

// 更复杂的例子
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

## 模板 vs render 函数的选择

- **模板**：大多数场景，直观可读，工具支持好
- **render 函数**：需要完整 JS 能力的场景（动态标签、复杂循环逻辑）
- **JSX**：习惯 React 开发模式，或组件主要是逻辑而非展示

## 小结

- `render` 函数接收 `h`（createElement），返回 VNode
- 模板最终也编译为 render 函数
- JSX 是 render 函数的语法糖，需要 Babel 插件
- 优先用模板，需要动态性时再用 render/JSX
