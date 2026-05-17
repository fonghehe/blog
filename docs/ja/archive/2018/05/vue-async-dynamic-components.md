---
title: "Vue 非同期コンポーネントと動的コンポーネント"
date: 2018-05-08 10:58:42
tags:
  - Vue
readingTime: 3
description: "コンポーネントの遅延ロードは初期バンドルサイズを削減する重要な手段です。Vueは非同期コンポーネントと動的コンポーネントの2つのメカニズムを提供しています。それぞれの違いと使い方を整理します。"
---

コンポーネントの遅延ロードは初期バンドルサイズを削減する重要な手段です。Vueは非同期コンポーネントと動的コンポーネントの2つのメカニズムを提供しています。それぞれの違いと使い方を整理します。

## 非同期コンポーネント

VueではPromiseを返す関数としてコンポーネントを定義できます：

```javascript
// 方法1：シンプルなファクトリー関数
const AsyncComponent = () => import("./HeavyComponent.vue");

// 方法2：オプション付きの高度な書き方（Vue 2.3+）
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"), // ロードするコンポーネント
  loading: LoadingSpinner, // ローディング中に表示
  error: ErrorFallback, // ロード失敗時に表示
  delay: 200, // 200ms後にローディングを表示（点滅を避ける）
  timeout: 10000, // タイムアウト時間
});
```

### ルートレベルの遅延ロード

最も一般的なユースケース：

```javascript
const routes = [
  {
    path: "/dashboard",
    component: () => import("@/views/Dashboard.vue"),
  },
  {
    path: "/users",
    // webpackChunkNameで同じchunkにまとめるファイルを制御
    component: () => import(/* webpackChunkName: "user" */ "@/views/Users.vue"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail.vue"),
  },
];
```

ユーザーが`/users`にアクセスした時だけ`user.[hash].js`がダウンロードされます。初期バンドルにはこれらのコードは含まれません。

### 条件付きレンダリングで非同期コンポーネントを使う

```vue
<template>
  <div>
    <button @click="showEditor = true">エディタを開く</button>

    <!-- リッチテキストエディタ（通常サイズが大きい）はクリック後にのみロード -->
    <RichTextEditor v-if="showEditor" content="..." />
  </div>
</template>

<script>
export default {
  components: {
    RichTextEditor: () => import("./RichTextEditor.vue"),
  },
  data() {
    return { showEditor: false };
  },
};
</script>
```

## 動的コンポーネント

`<component :is="xxx">`でランタイム時にコンポーネントを切り替えます：

```vue
<template>
  <div>
    <button @click="current = 'TabA'">Tab A</button>
    <button @click="current = 'TabB'">Tab B</button>
    <button @click="current = 'TabC'">Tab C</button>

    <!-- isにはコンポーネント名の文字列またはコンポーネントオブジェクトを指定可能 -->
    <component :is="current" />
  </div>
</template>

<script>
import TabA from "./TabA.vue";
import TabB from "./TabB.vue";
import TabC from "./TabC.vue";

export default {
  components: { TabA, TabB, TabC },
  data() {
    return { current: "TabA" };
  },
};
</script>
```

### keep-aliveで状態をキャッシュ

デフォルトでは、コンポーネントを切り替えると前のコンポーネントが破棄され、新しいものが作成されます。`<keep-alive>`でコンポーネントの状態を保持します：

```vue
<keep-alive>
  <component :is="current" />
</keep-alive>
```

`<keep-alive>`でラップされたコンポーネントは`created`/`destroyed`ではなく、以下がトリガーされます：

- `activated`：コンポーネントがアクティブになる（キャッシュから取り出される）
- `deactivated`：コンポーネントが非アクティブになる（キャッシュに入る）

```javascript
export default {
  activated() {
    // コンポーネントが再表示された — データの更新が必要な場合がある
    this.refreshData();
  },
  deactivated() {
    // コンポーネントがキャッシュされた — 必要に応じてクリーンアップ
  },
};
```

### 動的コンポーネント + 非同期ロードの組み合わせ

2つのパターンを組み合わせることができます：

```javascript
const componentMap = {
  bar: () => import("./BarChart.vue"),
  line: () => import("./LineChart.vue"),
  pie: () => import("./PieChart.vue"),
};

export default {
  computed: {
    currentChart() {
      return componentMap[this.chartType];
    },
  },
};
```

## まとめ

- 非同期コンポーネント：必要な時だけロード — 大きなコンポーネントやルートレベルの遅延ロードに最適
- 動的コンポーネント：ランタイム時にコンポーネントを切り替え — タブやウィザードのステップに便利
- `<keep-alive>`：状態をキャッシュし、繰り返し初期化を避ける
- 動的 + 非同期の組み合わせ：ユーザーが必要な特定のコンポーネントのみを遅延ロード
