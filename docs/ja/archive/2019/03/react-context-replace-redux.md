---
title: "React ContextによるReduxの代替"
date: 2019-03-06 17:27:58
tags:
  - React
readingTime: 1
description: "チームにReact ContextによるReduxの代替を普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。"
wordCount: 187
---

チームにReact ContextによるReduxの代替を普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。

## コア原理

コアコードは以下の通り：

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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## ソースコード分析

実際の例を見てみよう：

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

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## 実際のアプリケーション

以下の方法で実現できる：

```javascript
export default {
  props: ['items'],
  computed: {
    sorted() {
      return [...this.items].sort((a, b) => b.score - a.score)
```
