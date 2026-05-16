---
title: "React Context as a Redux Replacement"
date: 2019-03-06 17:27:58
tags:
  - React
readingTime: 1
description: "Promoting React Context as a Redux replacement within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
---

Promoting React Context as a Redux replacement within the team came with plenty of pitfalls. Documenting them here in the hope it helps others.

## Core Principles

Here is the core code:

```javascript
const { sum, debounce } = require("./utils");

describe("utils", () => {
  test("sum 计算正确", () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, 1)).toBe(0);
  });

  test("debounce 延迟执行", () => {
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

In real projects, you also need to consider edge cases and error handling.

## Source Code Analysis

Here is a practical example:

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反转</button>
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

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Real-World Application

This can be achieved with the following approach:

```javascript
export default {
  props: ['items'],
  computed: {
    sorted() {
      return [...this.items].sort((a, b) => b.score - a.score)
```
