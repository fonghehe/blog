---
title: "JavaScriptのクロージャとメモリ管理"
date: 2019-04-24 09:46:19
tags:
  - JavaScript
readingTime: 1
description: "JavaScriptのクロージャとメモリ管理は、日々の開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。"
---

JavaScriptのクロージャとメモリ管理は、日々の開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。

## クイックスタート

基本的な使い方から見てみましょう：

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

この書き方はシンプルで明快であり、ほとんどのシナリオに適しています。

## 高度な使い方

コアとなるコードは以下の通りです：

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

実際のプロジェクトでは、エッジケースと例外処理も考慮する必要があります。

## 実務シナリオ

実際の例を見てみましょう：

```javascript
import React, { Component } from "react";

class Form extends Component {
  state = { name: "", email: "", errors: {} };

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  handleSubmit = (e) => {
    e.preventDefault();
    const errors = this.validate();
    if (Object.keys(errors).length === 0) {
      this.props.onSubmit(this.state);
    } else {
      this.setState({ errors });
    }
  };

  validate() {
    const errors = {};
    if (!this.state.name) errors.name = "必須項目";
    if (!this.state.email.includes("@")) errors.email = "フォーマットエラー";
    return errors;
  }
}
```

クロージャを理解することはメモリリークを防ぐ上で重要です。コンポーネントのライフサイクルフックでは、イベントリスナーやタイマーを必ずクリーンアップしましょう。
