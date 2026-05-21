---
title: "Vue 2カスタムディレクティブ実践"
date: 2019-02-27 17:05:59
tags:
  - Vue
readingTime: 1
description: "チームにVue 2カスタムディレクティブを普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。"
wordCount: 307
---

チームにVue 2カスタムディレクティブを普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。

## 基本的な使い方

コアコードは以下の通り：

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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## 応用的なテクニック

実際の例を見てみよう：

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

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## 実践事例

以下の方法で実現できる：

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

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。

## まとめ

- 実際のプロジェクトではシナリオに応じた適切な方法を選ぶ
- チームで統一した規約を作ることは、完璧な実装を追求することより重要だ
- 継続的に学習・整理し、技術的な感度を維持する
