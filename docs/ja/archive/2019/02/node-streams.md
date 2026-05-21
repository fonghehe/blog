---
title: "Node.jsストリーム処理"
date: 2019-02-01 10:08:36
tags:
  - Node.js
readingTime: 1
description: "Node.jsのストリーム処理は、日々の開発でよく出会うテーマだ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。"
wordCount: 216
---

Node.jsのストリーム処理は、日々の開発でよく出会うテーマだ。この記事では実際のプロジェクト経験から、具体的な実装方法と教訓を紹介する。

## 基本コンセプト

基本的な使い方を見てみよう：

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

このパターンは簡潔で、ほとんどのシナリオに適している。

## 深掘り

コアコードは以下の通り：

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

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## プロジェクトへの応用

実際の例を見てみよう：

```javascript
import React, { Component } from "react";

class DataList extends Component {
  state = { items: [], loading: true };

  async componentDidMount() {
    const res = await fetch("/api/items");
    const items = await res.json();
    this.setState({ items, loading: false });
  }

  render() {
    const { items, loading } = this.state;
    if (loading) return <div>読み込み中...</div>;
    return (
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  }
}
```

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。
