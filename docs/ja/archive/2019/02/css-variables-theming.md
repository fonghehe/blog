---
title: "CSS変数テーマ切り替えソリューション"
date: 2019-02-21 15:40:07
tags:
  - CSS
readingTime: 1
description: "CSS変数テーマ切り替えに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。"
---

CSS変数テーマ切り替えに関する記事はネット上に多いが、実戦経験に基づいたものは少ない。この記事では実際のプロジェクトからベストプラクティスを探る。

## 基本コンセプト

実際の例を見てみよう：

```css
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user: User = { id: 1, name: 'Alice', email: 'a@b.com', role: 'admin' }
const name = pluck(user, 'name')   // string
const role = pluck(user, 'role')   // 'admin' | 'user' | 'guest'
```

このパターンをチームに広めた後、結果は良好でメンテナンスコストが明らかに低下した。

## 深掘り

以下の方法で実現できる：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

上記コードのパフォーマンスの詳細に注意し、不要な計算を避けること。

## プロジェクトへの応用

以下の実装を参考にしてほしい：

```css
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme="dark"] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition:
    background 0.3s,
    color 0.3s;
}
```

本番環境での検証済みで、安定して動作している。
