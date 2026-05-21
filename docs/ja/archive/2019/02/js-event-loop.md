---
title: "JavaScriptイベントループのメカニズム詳解"
date: 2019-02-15 17:14:02
tags:
  - JavaScript
readingTime: 1
description: "JavaScriptのイベントループに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。"
wordCount: 220
---

JavaScriptのイベントループに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。

## 基本的な使い方

実際の例を見てみよう：

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
    if (!this.state.name) errors.name = "必須";
    if (!this.state.email.includes("@")) errors.email = "フォーマットエラー";
    return errors;
  }

  render() {
    return <form onSubmit={this.handleSubmit}>...</form>;
  }
}
```

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## 応用的なテクニック

以下の方法で実現できる：

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

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。

## 実践事例

以下の実装を参考にしてほしい：

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

本番環境での検証済みで、安定して動作している。
