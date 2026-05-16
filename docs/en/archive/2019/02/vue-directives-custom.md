---
title: "Vue 2 Custom Directives in Practice"
date: 2019-02-27 17:05:59
tags:
  - Vue
readingTime: 1
description: "Promoting Vue 2 custom directives within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
---

Promoting Vue 2 custom directives within the team came with plenty of pitfalls. Documenting them here in the hope it helps others.

## Basic Usage

Here is the core code:

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">Reverse</button>
  </div>
</template>

<script>
export default {
  data() {
    return { message: 'Hello Vue 2' }
  },
  methods: {
    reverse() {
      this.message = this.message.split('').reverse().join('')
    }
  }
}
</script>
{% endraw %}
```

In real projects, you also need to consider edge cases and error handling.

## Advanced Techniques

Here is a real-world example:

```javascript
export default {
  props: ["items"],
  computed: {
    sorted() {
      return [...this.items].sort((a, b) => b.score - a.score);
    },
    count() {
      return this.items.length;
    },
  },
  filters: {
    formatDate(val) {
      return new Date(val).toLocaleDateString("en-US");
    },
  },
};
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Real-World Case Study

This can be achieved with the following approach:

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus();
      },
    },
    loading: {
      bind(el, binding) {
        if (binding.value) {
          el.classList.add("loading");
        }
      },
      update(el, binding) {
        el.classList.toggle("loading", binding.value);
      },
    },
  },
};
```

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Summary

- Choose the right approach for the scenario in real projects
- Establishing team-wide conventions matters more than pursuing perfect implementations
- Keep learning and summarizing; stay technically sharp
