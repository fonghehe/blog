---
title: "Vueカスタムディレクティブ実践：v-focusからv-permissionまで"
date: 2019-06-24 16:31:12
tags:
  - Vue
readingTime: 2
description: "Vueの組み込みディレクティブ（`v-model`、`v-if`、`v-for`）はほとんどのユースケースをカバーしますが、DOM動作を直接操作する必要があるシナリオがあります——そこでカスタムディレクティブが活躍します。本記事ではディレクティブのライフサイクルフックと2つの実際のユースケースを説明します。"
---

Vueの組み込みディレクティブ（`v-model`、`v-if`、`v-for`）はほとんどのユースケースをカバーしますが、DOM動作を直接操作する必要があるシナリオがあります——そこでカスタムディレクティブが活躍します。本記事ではディレクティブのライフサイクルフックと2つの実際のユースケースを説明します。

## ディレクティブのライフサイクルフック

```javascript
Vue.directive("my-directive", {
  // 要素が親にバインドされる前に1回呼ばれる
  bind(el, binding, vnode) {
    // el: 要素
    // binding: { value, oldValue, arg, modifiers, name }
    // vnode: Vueの仮想ノード
  },

  // 要素が親DOMに挿入された後に1回呼ばれる
  inserted(el, binding, vnode) {},

  // コンポーネントのVNodeが更新された時に呼ばれる
  update(el, binding, vnode, oldVnode) {},

  // コンポーネントの子VNodesが更新された後に呼ばれる
  componentUpdated(el, binding, vnode, oldVnode) {},

  // ディレクティブが要素からアンバインドされた時に1回呼ばれる
  unbind(el, binding, vnode) {},
});
```

実際には`bind`と`inserted`が最もよく使われます。`bind`は要素がDOMに挿入される前に実行（サイズを計測できない）；`inserted`は要素が挿入された後に実行（計算されたスタイルやサイズにアクセス可能）。

## 例1：v-showに対応したv-focus

```javascript
// シンプルなv-focus: マウント時にフォーカス
Vue.directive("focus", {
  inserted(el) {
    el.focus();
  },
});
// 使用法: <input v-focus />
```

しかし`v-show`と一緒に使うと壊れます——要素がマウント時に非表示の場合があるからです。MutationObserverを追加して対応：

```javascript
Vue.directive("focus", {
  inserted(el, binding) {
    if (el.style.display !== "none") {
      el.focus();
      return;
    }
    // MutationObserverで表示状態の変化を監視
    const observer = new MutationObserver(() => {
      if (el.style.display !== "none") {
        el.focus();
        observer.disconnect();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    // アンマウント時にオブザーバーをクリーンアップ
    el._focusObserver = observer;
  },
  unbind(el) {
    el._focusObserver?.disconnect();
  },
});
```

## 例2：管理システム向けv-permission

```javascript
// グローバルに登録
Vue.directive("permission", {
  inserted(el, binding) {
    const { value: requiredPermissions } = binding;
    const userPermissions = store.getters["auth/permissions"];

    const hasPermission = Array.isArray(requiredPermissions)
      ? requiredPermissions.some((p) => userPermissions.includes(p))
      : userPermissions.includes(requiredPermissions);

    if (!hasPermission) {
      // 非表示にするのではなく、DOMから要素を削除
      el.parentNode?.removeChild(el);
    }
  },
});
```

```html
<!-- 使用法 -->
<!-- 単一パーミッション -->
<button v-permission="'user:delete'">ユーザー削除</button>

<!-- 複数パーミッションのいずれか -->
<button v-permission="['user:edit', 'user:delete']">編集</button>
```

カスタムディレクティブはDOMへの直接アクセスが必要なロジックに最適です。状態を含むコンポーネントレベルの動作には、代わりにComposables（Vue 2ではMixins）を使用しましょう。
