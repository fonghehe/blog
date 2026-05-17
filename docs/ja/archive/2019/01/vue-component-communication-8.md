---
title: "Vue 2コンポーネント通信8つの方法"
date: 2019-01-11 16:18:56
tags:
  - Vue
readingTime: 2
description: "Vue 2のコンポーネント通信パターンに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。"
---

Vue 2のコンポーネント通信パターンに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。

## コア原理

実際の例を見てみよう：

```javascript
const { sum, debounce } = require("./utils");

describe("utils", () => {
  test("sumが正確に計算されること", () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, 1)).toBe(0);
  });

  test("debounceが遅延実行されること", () => {
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

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## ソース分析

以下の方法で実現できる：

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反転</button>
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

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。

## 実践的な応用

以下の実装を参考にしてほしい：

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
      return new Date(val).toLocaleDateString("ja-JP");
    },
  },
};
```

本番環境での検証済みで、安定して動作している。

## まとめ

- チームで統一した規約を作ることは、完璧な実装を追求することより重要だ
- 継続的に学習・整理し、技術的な感度を維持する
- 疑問があればソースコードと公式ドキュメントを読む
- Vue 2コンポーネント通信のカギはコアコンセプトを理解すること——表面的な使い方にとどまらないこと
