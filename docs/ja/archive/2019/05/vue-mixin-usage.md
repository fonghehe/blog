---
title: "Vue 2 Mixinの使い方と落とし穴"
date: 2019-05-07 17:00:41
tags:
  - Vue
readingTime: 2
description: "Vue 2 Mixinについて理解に誤りがある開発者が多いです。本記事では重要なポイントとよくある誤解を体系的に整理します。"
wordCount: 357
---

Vue 2 Mixinについて理解に誤りがある開発者が多いです。本記事では重要なポイントとよくある誤解を体系的に整理します。

## 基本的な使い方

Mixinはコンポーネントオプションを含むオブジェクトで、任意のコンポーネントにミックスインできます：

```javascript
// Mixinを定義
const loadingMixin = {
  data() {
    return { loading: false, error: null };
  },
  methods: {
    async fetchData(fn) {
      this.loading = true;
      this.error = null;
      try {
        return await fn();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
};

// コンポーネントで使用
export default {
  mixins: [loadingMixin],
  data() {
    return { users: [] };
  },
  async created() {
    this.users = await this.fetchData(() => api.getUsers());
  },
};
```

## マージ戦略

MixinとコンポーネントのオプションPが同じ場合、特定のルールに従ってマージされます：

- **data**：再帰的にマージ、競合時はコンポーネントが優先
- **ライフサイクルフック**：配列にマージ、Mixinのフックが先に実行
- **methods/computed/components**：競合時はコンポーネントが優先

```javascript
const mixin = {
  data() {
    return { name: "mixin", extra: "from mixin" };
  },
  created() {
    console.log("mixin created");
  },
};

const component = {
  mixins: [mixin],
  data() {
    return { name: "component" };
  }, // mixinをオーバーライド
  created() {
    console.log("component created");
  },
};
// ログ出力：'mixin created'の後に'component created'
// data: { name: 'component', extra: 'from mixin' }
```

## よくある落とし穴

1. **命名の競合**：Mixin同士がサイレントに上書きし合う——`$_mixinName_method`のようなプレフィックスを使う
2. **暗黙的な依存**：Mixinのメソッドがそのmixin自体に定義されていないdataやメソッドに依存することがある
3. **追跡困難**：複数のMixinがあると、プロパティがどこから来るか分かりにくい

Vue 3では、Composition APIの`composables`がこれらの問題をすべて解決し、Mixinはほぼ不要になります。
