---
title: "ReactのHOC（高階コンポーネント）パターン"
date: 2019-04-09 10:45:08
tags:
  - React
readingTime: 1
description: "ReactのHOC（高階コンポーネント）パターンに関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。"
---

ReactのHOC（高階コンポーネント）パターンに関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。

## 基本的な使い方

実際の例を見てみましょう：

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

このパターンをチームに展開した後、効果は非常に良く、メンテナンスコストが明らかに下がりました。

## 応用テクニック

以下の方法で実装できます：

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

上記コードのパフォーマンス上の注意点に気をつけ、不要な計算を避けましょう。

## 実践ケース

具体的な実装は以下のコードを参照してください：

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

HOCはコンポーネントを受け取り新しいコンポーネントを返す関数です。それ自体はコンポーネントではありません。認証・ログ記録・データフェッチなどの横断的関心事にHOCを活用しましょう。
