---
title: "Vue プラグイン開発の実践"
date: 2018-09-21 10:12:44
tags:
  - Vue
readingTime: 2
description: "Vue のプラグイン機構によって機能をグローバルに登録でき、`Vue.use()` で一発で導入できます。社内用のメッセージ表示プラグインを作成したので、開発過程を記録します。"
wordCount: 269
---

Vue のプラグイン機構によって機能をグローバルに登録でき、`Vue.use()` で一発で導入できます。社内用のメッセージ表示プラグインを作成したので、開発過程を記録します。

## Vue プラグインの構造

プラグインは `install` メソッドを持つ必要があります（またはプラグイン自体が関数）：

```javascript
// プラグインの基本構造
const MyPlugin = {
  install(Vue, options) {
    // options は Vue.use(MyPlugin, options) で渡した設定

    // 1. グローバルメソッドまたはプロパティを追加
    Vue.myGlobalMethod = function () {};

    // 2. グローバルアセットを追加：ディレクティブ、フィルター、トランジションなど
    Vue.directive("my-directive", {
      /* ... */
    });
    Vue.filter("my-filter", function () {
      /* ... */
    });

    // 3. コンポーネントオプションをインジェクト
    Vue.mixin({
      created() {
        /* ... */
      },
    });

    // 4. インスタンスメソッドを追加（プロトタイプを通じて）
    Vue.prototype.$myMethod = function () {
      /* ... */
    };
  },
};
```

## 実践：$toast メッセージ表示プラグイン

```javascript
// plugins/toast/index.js
import ToastComponent from "./Toast.vue";

let instance = null;

const Toast = {
  install(Vue) {
    // Vue のサブクラスを作成して Toast コンポーネントをマウント
    const ToastConstructor = Vue.extend(ToastComponent);

    function showToast(message, type = "info", duration = 3000) {
      if (!instance) {
        instance = new ToastConstructor();
        instance.$mount();
        document.body.appendChild(instance.$el);
      }
      instance.show(message, type, duration);
    }

    // Vue のプロトタイプに追加
    Vue.prototype.$toast = {
      info: (msg, duration) => showToast(msg, "info", duration),
      success: (msg, duration) => showToast(msg, "success", duration),
      warning: (msg, duration) => showToast(msg, "warning", duration),
      error: (msg, duration) => showToast(msg, "error", duration),
    };
  },
};

export default Toast;
```

```vue
<!-- plugins/toast/Toast.vue -->
<template>
  <transition name="toast-fade">
    <div v-if="visible" :class="['toast', `toast--${type}`]">
      {{ message }}
    </div>
  </transition>
</template>

<script>
export default {
  data() {
    return {
      visible: false,
      message: "",
      type: "info",
    };
  },
  methods: {
    show(message, type, duration) {
      this.message = message;
      this.type = type;
      this.visible = true;
      setTimeout(() => {
        this.visible = false;
      }, duration);
    },
  },
};
</script>
```

## 登録と使用

```javascript
// main.js
import Toast from "./plugins/toast";
Vue.use(Toast);

// 任意のコンポーネント内で
this.$toast.success("保存しました！");
this.$toast.error("ネットワークエラー。再試行してください");
```

## グローバル設定を持つプラグイン

```javascript
const Loading = {
  install(Vue, options = {}) {
    const defaultOptions = {
      color: "#409EFF",
      text: "読み込み中...",
    };
    const config = { ...defaultOptions, ...options };

    Vue.prototype.$loading = {
      show(text = config.text) {
        // loading を表示
      },
      hide() {
        // loading を非表示
      },
    };
  },
};

// 使用時に設定を渡す
Vue.use(Loading, { color: "#f90", text: "しばらくお待ちください..." });
```

## まとめ

- プラグイン = `install(Vue, options)` 関数
- `Vue.prototype.$xxx`：インスタンスメソッドを追加。すべてのコンポーネントで `this.$xxx` が使える
- `Vue.extend` + 手動 `$mount`：コンポーネントを動的に作成して body にマウント
- プラグインが向いている用途：グローバルな toast/loading/dialog、グローバルフィルター/ディレクティブ、グローバルミックスイン
