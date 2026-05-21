---
title: "React Higher-Order Component (HOC) Pattern"
date: 2019-04-09 10:45:08
tags:
  - React
readingTime: 1
description: "There are plenty of articles on the React Higher-Order Component (HOC) pattern online, but most lack real-world experience. This article explores best practices"
wordCount: 116
---

There are plenty of articles on the React Higher-Order Component (HOC) pattern online, but most lack real-world experience. This article explores best practices based on actual projects.

## Basic Usage

Here is a practical example:

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

After rolling this pattern out across the team, the results were great — maintenance costs dropped noticeably.

## Advanced Techniques

This can be implemented as follows:

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

Pay attention to the performance details in the code above and avoid unnecessary computations.

## Practical Case

Refer to the following code for a concrete implementation:

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

A HOC is a function that takes a component and returns a new component — it is not a component itself. Use HOCs for cross-cutting concerns like authentication, logging, and data fetching.
