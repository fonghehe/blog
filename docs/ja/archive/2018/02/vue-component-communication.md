---
title: "Vue コンポーネント間通信の6つの方法"
date: 2018-02-10 09:39:52
tags:
  - Vue
readingTime: 4
description: "Vue におけるコンポーネント間通信は避けて通れないテーマです。シナリオによって適切な方法が異なります。6つの方法をまとめて参照しやすくしました。"
---

Vue におけるコンポーネント間通信は避けて通れないテーマです。シナリオによって適切な方法が異なります。6つの方法をまとめて参照しやすくしました。

## 1. Props / $emit（親子通信）

最も基本的な方法：親から子へは props、子から親へは emit：

```vue
<!-- 親コンポーネント -->
<template>
  <ChildComponent :title="pageTitle" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { pageTitle: "私のページ" };
  },
  methods: {
    handleUpdate(newTitle) {
      this.pageTitle = newTitle;
    },
  },
};
</script>
```

```vue
{% raw %}
<!-- 子コンポーネント -->
<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('update', '新しいタイトル')">タイトルを変更</button>
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      required: true,
    },
  },
};
</script>
{% endraw %}
```

**適したシナリオ**：直接の親子関係でロジックがシンプルな場合。

## 2. v-model（親子双方向バインディングの糖衣構文）

`v-model` は `:value + @input` の糖衣構文です：

```vue
<!-- 親コンポーネント -->
<CustomInput v-model="searchText" />
<!-- 以下と同等 -->
<CustomInput :value="searchText" @input="searchText = $event" />
```

```vue
<!-- 子コンポーネント CustomInput.vue -->
<template>
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ["value"],
};
</script>
```

**適したシナリオ**：フォームコントロール、入力系コンポーネント。

## 3. $parent / $children（インスタンスへの直接アクセス）

```javascript
// 子から親へアクセス
this.$parent.someData = "changed";
this.$parent.someMethod();

// 親から子へアクセス
this.$children[0].childMethod();
// より良い方法：$refs を使う
this.$refs.myChild.childMethod();
```

**⚠️ 非推奨**：結合度が高くリファクタリングが困難。知識として知っておく程度で、実際のプロジェクトでは避けること。

## 4. $attrs / $listeners（クロスレイヤー透過）

Vue 2.4 で導入された、各レイヤーで props を書かなくても「孫コンポーネントへの透過」問題を解決する機能：

```vue
<!-- 祖父コンポーネント -->
<ChildWrapper :user-id="123" :theme="'dark'" @save="handleSave" />
```

```vue
<!-- 中間層（これらの props を気にせず、ただ透過するだけ） -->
<template>
  <GrandChild v-bind="$attrs" v-on="$listeners" />
</template>

<script>
export default {
  inheritAttrs: false, // attrs がルート要素に自動バインドされるのを防ぐ
};
</script>
```

```vue
<!-- 孫コンポーネント -->
<script>
export default {
  props: ["userId", "theme"], // 祖父コンポーネントからの props を直接宣言できる
};
</script>
```

**適したシナリオ**：高階コンポーネントのラップ、属性を下位コンポーネントに透過する。

## 5. provide / inject（依存性注入）

祖先コンポーネントがデータを提供し、任意の子孫コンポーネントがインジェクトできます：

```javascript
// 祖先コンポーネント
export default {
  provide() {
    return {
      theme: "dark",
      getUser: this.getUser, // メソッドも提供できる
    };
  },
};
```

```javascript
// 任意の子孫コンポーネント（どれだけ深くネストされていても）
export default {
  inject: ["theme", "getUser"],
  mounted() {
    console.log(this.theme); // 'dark'
  },
};
```

注意：`provide` のデータは**デフォルトではリアクティブではありません**。リアクティブにするにはリアクティブなオブジェクトを渡すか `Vue.observable` を使います。

**適したシナリオ**：コンポーネントライブラリ（Form が FormItem にバリデーションルールを注入するなど）、テーマの伝達。

## 6. EventBus / Vuex（コンポーネント間通信）

### EventBus（シンプルなケース）

```javascript
// event-bus.js
import Vue from "vue";
export const bus = new Vue();
```

```javascript
// コンポーネント A（イベント送信）
import { bus } from "./event-bus";
bus.$emit("user-updated", { name: "Alice" });
```

```javascript
// コンポーネント B（イベント受信）
import { bus } from "./event-bus";

export default {
  created() {
    bus.$on("user-updated", (user) => {
      this.currentUser = user;
    });
  },
  beforeDestroy() {
    bus.$off("user-updated"); // クリーンアップを忘れずに！
  },
};
```

**適したシナリオ**：小規模アプリ、偶発的なコンポーネント間イベント。乱用するとデータの流れが追いにくくなるので注意。

### Vuex（複雑なケース）

状態を多くのコンポーネントで共有する必要がある場合、タイムトラベルデバッグが必要な場合、ビジネスロジックが複雑な場合に使います。

```javascript
// store.js
export default new Vuex.Store({
  state: { user: null },
  mutations: {
    SET_USER(state, user) {
      state.user = user;
    },
  },
  actions: {
    async login({ commit }, credentials) {
      const user = await api.login(credentials);
      commit("SET_USER", user);
    },
  },
});
```

## 選び方

| シナリオ                               | 推奨手段            |
| -------------------------------------- | ------------------- |
| 直接の親子                             | props / emit        |
| フォームコントロール                   | v-model             |
| コンポーネントライブラリ内の深いネスト | provide / inject    |
| 高階コンポーネントのラップ             | $attrs / $listeners |
| 小規模アプリのコンポーネント間イベント | EventBus            |
| 中〜大規模アプリの共有状態             | Vuex                |

原則：**十分なものを使い、過度に設計しない**。3階層以内のコンポーネント通信には props/emit を使い、より複雑な場合にのみ他の手段を検討する。
