---
title: "Vue カスタムディレクティブ開発"
date: 2018-03-22 09:45:46
tags:
  - Vue
readingTime: 3
description: "Vue のカスタムディレクティブを使えば DOM を直接操作できます。自動フォーカス、権限制御、画像遅延読み込みなど、DOM 要素への直接アクセスが必要なロジックをカプセル化するのに最適です。"
wordCount: 484
---

Vue のカスタムディレクティブを使えば DOM を直接操作できます。自動フォーカス、権限制御、画像遅延読み込みなど、DOM 要素への直接アクセスが必要なロジックをカプセル化するのに最適です。

## ディレクティブのライフサイクルフック

```javascript
Vue.directive("my-directive", {
  bind(el, binding, vnode) {
    // ディレクティブが要素にバインドされたときに一度だけ呼ばれる
    // この時点では要素がまだ DOM に挿入されていない可能性がある
  },
  inserted(el, binding, vnode) {
    // 要素が親 DOM に挿入された後に呼ばれる
    // DOM を操作できる。親要素は存在する
  },
  update(el, binding, vnode, oldVnode) {
    // コンポーネントの VNode が更新されたときに呼ばれる
    // 注意：子コンポーネントはまだ更新されていない場合がある
  },
  componentUpdated(el, binding, vnode, oldVnode) {
    // コンポーネントと子コンポーネントの VNode がすべて更新された後に呼ばれる
  },
  unbind(el, binding, vnode) {
    // ディレクティブが要素からアンバインドされるときに一度だけ呼ばれる
    // クリーンアップはここで行う
  },
});
```

`binding` オブジェクトの内容：

- `binding.value`：ディレクティブの値（`v-my-dir="value"` の `value`）
- `binding.arg`：ディレクティブの引数（`v-my-dir:arg`）
- `binding.modifiers`：修飾子のオブジェクト（`v-my-dir.modifier`）

## 実例 1：自動フォーカス

```javascript
Vue.directive("focus", {
  inserted(el) {
    el.focus();
  },
});
```

```vue
<el-input v-focus placeholder="検索" />
```

## 実例 2：権限制御

ユーザーの権限に基づいて要素の表示を制御する：

```javascript
// src/directives/permission.js
import store from "@/store";

export default {
  inserted(el, binding) {
    const required = binding.value; // 必要な権限、例：'admin' または ['admin', 'editor']
    const userPerms = store.getters.permissions;

    const requiredList = Array.isArray(required) ? required : [required];
    const hasPermission = requiredList.some((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      el.parentNode?.removeChild(el); // DOM から直接削除
    }
  },
};
```

```javascript
// グローバル登録
import permissionDirective from "./directives/permission";
Vue.directive("permission", permissionDirective);
```

```vue
<template>
  <div>
    <!-- admin だけが見える -->
    <el-button v-permission="'admin'" type="danger">削除</el-button>

    <!-- admin または editor が見える -->
    <el-button v-permission="['admin', 'editor']">編集</el-button>
  </div>
</template>
```

## 実例 3：画像の遅延読み込み

```javascript
Vue.directive("lazyload", {
  inserted(el, binding) {
    const src = binding.value;

    // IntersectionObserver で要素がビューポート内にあるかを検出
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.src = src;
            observer.unobserve(el); // 読み込み後は監視を解除
          }
        });
      },
      {
        threshold: 0.1, // 要素が 10% 表示されたらトリガー
      },
    );

    observer.observe(el);
    el._observer = observer; // unbind でのクリーンアップ用に参照を保持
  },
  unbind(el) {
    el._observer?.disconnect();
  },
});
```

```vue
<img
  v-lazyload="'https://example.com/large-image.jpg'"
  src="/placeholder.png"
/>
```

## 実例 4：重複クリック防止

ボタンを連続クリックして複数回リクエストが送られるのを防ぐ：

```javascript
Vue.directive("throttle", {
  bind(el, binding) {
    const delay = binding.value || 1000;
    let lastTime = 0;

    el._throttleHandler = function (event) {
      const now = Date.now();
      if (now - lastTime < delay) {
        event.stopImmediatePropagation(); // 後続のイベントハンドラをブロック
        return;
      }
      lastTime = now;
    };

    el.addEventListener("click", el._throttleHandler, true); // キャプチャーフェーズ
  },
  unbind(el) {
    el.removeEventListener("click", el._throttleHandler, true);
  },
});
```

```vue
<el-button v-throttle="2000" @click="handleSubmit">送信</el-button>
```

## 実例 5：外部クリックで閉じる

ポップアップやドロップダウンメニューでよくある要件：

```javascript
Vue.directive("click-outside", {
  bind(el, binding) {
    el._clickOutsideHandler = function (event) {
      if (!el.contains(event.target)) {
        binding.value(event); // 渡された関数を呼び出す
      }
    };
    document.addEventListener("click", el._clickOutsideHandler);
  },
  unbind(el) {
    document.removeEventListener("click", el._clickOutsideHandler);
  },
});
```

```vue
<div v-click-outside="closeDropdown" class="dropdown">
  <!-- ドロップダウン内容 -->
</div>
```

## ローカル登録

グローバル登録は必須ではありません。コンポーネント内でローカルに登録できます：

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus();
      },
    },
  },
};
```

## まとめ

カスタムディレクティブは **DOM を直接操作する**ロジックに向いており、ビジネスロジックには向いていません。

- `unbind` でイベントリスナーや IntersectionObserver などのリソースを必ずクリーンアップする
- まずコンポーネントや mixin で実装できないか検討し、ディレクティブは補助手段として使う
- 実用的なディレクティブ：権限制御、遅延読み込み、クリックスロットル、外部クリックで閉じる
