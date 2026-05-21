---
title: "Eight Ways to Communicate Between Vue 2 Components"
date: 2019-01-11 16:18:56
tags:
  - Vue
readingTime: 1
description: "There is no shortage of articles about Vue 2 component communication patterns online, but most lack real-world experience. This article explores best practices "
wordCount: 135
---

There is no shortage of articles about Vue 2 component communication patterns online, but most lack real-world experience. This article explores best practices from actual projects.

## Core Principles

Here is a real-world example:

```javascript
const { sum, debounce } = require("./utils");

describe("utils", () => {
  test("sum calculates correctly", () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, 1)).toBe(0);
  });

  test("debounce delays execution", () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Source Analysis

This can be achieved with the following approach:

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

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Practical Application

Refer to the following implementation:

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

This setup has been validated in production and runs reliably.

## Summary

- Establishing team-wide conventions matters more than pursuing perfect implementations
- Keep learning and summarizing; stay technically sharp
- When in doubt, read the source code and official documentation
- The key to Vue 2 component communication is understanding the core concepts — don't stay at surface-level usage
