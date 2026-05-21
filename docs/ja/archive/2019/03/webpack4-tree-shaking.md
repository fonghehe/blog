---
title: "Webpack 4 Tree Shaking 深掘り"
date: 2019-03-21 09:49:12
tags:
  - Webpack
  - エンジニアリング
readingTime: 1
description: "チームにWebpack 4 Tree Shakingを普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。"
wordCount: 292
---

チームにWebpack 4 Tree Shakingを普及させる過程で、多くの落とし穴を経験した。同じ苦労をする人が減るよう、ここに記録しておく。

## 基本的な使い方

コアコードは以下の通り：

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
    if (!this.state.name) errors.name = "必填";
    if (!this.state.email.includes("@")) errors.email = "格式错误";
    return errors;
  }

  render() {
    return <form onSubmit={this.handleSubmit}>...</form>;
  }
}
```

実際のプロジェクトでは、エッジケースとエラー処理も考慮する必要がある。

## 応用テクニック

実際の例を見てみよう：

```javascript
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== "object") return obj;
  if (map.has(obj)) return map.get(obj);

  const clone = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], map);
  }
  return clone;
}
```

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## 実践ケース

以下の方法で実現できる：

```javascript
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}
```

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。

## まとめ

- 実際のプロジェクトではシナリオに応じて適切な方法を選ぶ
- チームでの統一した規約は、完璧な実装を追求するよりも重要
- 継続的に学習・まとめを行い、技術的な感度を保つ
