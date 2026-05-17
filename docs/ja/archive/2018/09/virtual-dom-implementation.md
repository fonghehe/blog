---
title: "ゼロから実装するシンプルな Virtual DOM"
date: 2018-09-19 11:22:09
tags:
  - フロントエンド
readingTime: 3
description: "Virtual DOM は React と Vue 2 の中核概念です。多くの記事を読みましたが、自分で実装して初めて本当に理解できます。この記事では数百行のコードで最小限の VDOM を実装します。"
---

Virtual DOM は React と Vue 2 の中核概念です。多くの記事を読みましたが、自分で実装して初めて本当に理解できます。この記事では数百行のコードで最小限の VDOM を実装します。

## なぜ Virtual DOM が必要か

DOM の直接操作が遅すぎるのでしょうか？実はそれだけではありません。本当の問題は：

1. DOM を直接操作する場合、状態変化を手動で追跡する必要があり、コードが複雑になる
2. DOM の全量更新は確かに遅いですが、VDOM の真の価値は**クロスプラットフォーム**と**宣言型 UI**にあります

Virtual DOM は JS オブジェクトで記述された「仮想」DOM ツリーです。更新時に新旧の VDOM を比較（diff）し、差分だけを実 DOM に適用（patch）します。

## ステップ1：VNode 構造の定義

```javascript
// VNode：DOM ノードを記述する
// h('div', { class: 'container' }, [h('p', null, 'Hello')])
function h(type, props, ...children) {
  return {
    type,
    props: props || {},
    children: children
      .flat()
      .map((child) =>
        typeof child === "string" ? { type: "TEXT_NODE", value: child } : child,
      ),
  };
}
```

## ステップ2：VNode を実 DOM に変換（mount）

```javascript
function createElement(vnode) {
  // テキストノード
  if (vnode.type === "TEXT_NODE") {
    return document.createTextNode(vnode.value);
  }

  // 要素ノード
  const el = document.createElement(vnode.type);

  // 属性を設定
  for (const [key, value] of Object.entries(vnode.props)) {
    if (key.startsWith("on")) {
      // イベントリスナー
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
    } else {
      el.setAttribute(key, value);
    }
  }

  // 子ノードを再帰的に作成
  vnode.children.forEach((child) => {
    el.appendChild(createElement(child));
  });

  // 対応する DOM 要素を保存。patch 時に使用
  vnode._el = el;

  return el;
}

// 初回マウント
function mount(vnode, container) {
  const el = createElement(vnode);
  container.appendChild(el);
}
```

## ステップ3：diff アルゴリズム

最も重要な部分です。新旧の VNode を比較して差分を見つけます：

```javascript
function diff(oldVNode, newVNode) {
  // 型が異なる場合：直接置き換え
  if (oldVNode.type !== newVNode.type) {
    const newEl = createElement(newVNode);
    oldVNode._el.parentNode.replaceChild(newEl, oldVNode._el);
    return;
  }

  // テキストノード：テキストを更新
  if (newVNode.type === "TEXT_NODE") {
    if (oldVNode.value !== newVNode.value) {
      oldVNode._el.nodeValue = newVNode.value;
    }
    newVNode._el = oldVNode._el;
    return;
  }

  // 同じ型の要素：DOM を再利用して属性と子ノードを更新
  const el = (newVNode._el = oldVNode._el);

  patchProps(el, oldVNode.props, newVNode.props);
  patchChildren(el, oldVNode.children, newVNode.children);
}

function patchProps(el, oldProps, newProps) {
  // 古い属性を削除
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // 新しい属性を設定
  for (const [key, value] of Object.entries(newProps)) {
    if (oldProps[key] !== value) {
      if (key.startsWith("on")) {
        if (oldProps[key]) {
          el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
        }
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        el.setAttribute(key, value);
      }
    }
  }
}

function patchChildren(el, oldChildren, newChildren) {
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    if (!oldChildren[i]) {
      // ノードを追加
      el.appendChild(createElement(newChildren[i]));
    } else if (!newChildren[i]) {
      // ノードを削除
      el.removeChild(oldChildren[i]._el);
    } else {
      // ノードを更新
      diff(oldChildren[i], newChildren[i]);
    }
  }
}
```

## ステップ4：シンプルなリアクティブ

VDOM と状態更新を組み合わせます：

```javascript
let currentVNode = null;
let container = null;

function render(vnode, mountPoint) {
  if (!currentVNode) {
    // 初回レンダリング
    mount(vnode, mountPoint);
    container = mountPoint;
  } else {
    // 更新
    diff(currentVNode, vnode);
  }
  currentVNode = vnode;
}

// シンプルなアプリ
let state = { count: 0 };

function view(state) {
  return h(
    "div",
    { class: "app" },
    h("p", null, `Count: ${state.count}`),
    h("button", { onClick: increment }, "+1"),
    h("button", { onClick: decrement }, "-1"),
  );
}

function increment() {
  state = { ...state, count: state.count + 1 };
  render(view(state), document.getElementById("app"));
}

function decrement() {
  state = { ...state, count: state.count - 1 };
  render(view(state), document.getElementById("app"));
}

// 初回レンダリング
render(view(state), document.getElementById("app"));
```

## 本物の diff はどれほど複雑か

私たちの `patchChildren` は最もシンプルな順序比較で、多くの問題があります：

```
旧：[A, B, C, D]
新：[A, C, B, D]  // B と C の順序を入れ替えただけ
```

このシンプルな版では B と C の2ノードを更新しますが、実際には C（または B）を移動するだけで済みます。

本物の実装（Vue 2 の双端比較、Vue 3 の最長増加部分列）では `key` でノードの同一性を識別し、より効率的なアルゴリズムで最小移動回数を求めます。これが VDOM 実装の最も複雑な部分です。

## まとめ

- VNode は JS オブジェクトで記述された仮想 DOM ノード
- mount：VNode → 実 DOM
- diff：新旧 VNode を比較して差分を見つける
- patch：差分を実 DOM に適用する
- 完全な実装には key、コンポーネント、非同期更新キューなどの処理も必要
