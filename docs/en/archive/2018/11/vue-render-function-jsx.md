---
title: "Vue render Functions and JSX"
date: 2018-11-20 11:14:48
tags:
  - Vue
readingTime: 2
description: "Templates work fine most of the time, but render functions are more flexible in certain scenarios."
---

Templates work fine most of the time, but render functions are more flexible in certain scenarios.

## Why Render Functions Are Needed

Templates have limitations — you can't generate different tags dynamically based on props:

```javascript
// ❌ Templates can't do this (can't dynamically specify a tag name based on a prop)
// <component :is="level">  // works, but gets messy with complex tag name logic

// ✅ A render function gives you full JS control
export default {
  props: {
    level: { type: Number, required: true },
  },
  render(h) {
    return h("h" + this.level, this.$slots.default);
  },
};
// <Heading :level="2">Title</Heading> → <h2>Title</h2>
```

## `createElement` (h) Arguments

```javascript
h(
  // 1. Tag name, component options object, or async function
  "div",

  // 2. Data object (optional)
  {
    class: { active: true, disabled: false },
    style: { color: "red", fontSize: "14px" },
    attrs: { id: "app", "data-id": "123" },
    props: { value: "hello" },
    on: { click: this.handleClick },
    // Native events (on component)
    nativeOn: { click: this.handleNativeClick },
  },

  // 3. Child nodes (optional)
  ["text content", h("span", "child")],
);
```

## Real-world Example: Dynamic Form

Generate different form field types from configuration:

```javascript
const FormField = {
  props: {
    type: String, // 'input' | 'select' | 'textarea'
    value: [String, Number],
    options: Array, // select options
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

## JSX: A More Readable Render Function

After configuring the Babel JSX plugin, you can use JSX instead of `h` calls:

```bash
npm install --save-dev @vue/babel-preset-jsx @vue/babel-helper-vue-jsx-merge-props
```

```javascript
// Equivalent to the above, written in JSX
export default {
  props: { level: Number },
  render() {
    const Tag = `h${this.level}`
    return <Tag>{this.$slots.default}</Tag>
  }
}

// More complex example
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

## Template vs Render Function: Which to Choose?

- **Template**: most scenarios — intuitive, readable, excellent tooling support
- **Render function**: when you need full JS power (dynamic tags, complex loop logic)
- **JSX**: if you're used to React patterns, or when a component is primarily logic rather than presentation

## Summary

- The `render` function receives `h` (createElement) and returns a VNode
- Templates are ultimately compiled into render functions
- JSX is syntactic sugar for render functions and requires a Babel plugin
- Default to templates; switch to render/JSX only when you need the dynamic flexibility
