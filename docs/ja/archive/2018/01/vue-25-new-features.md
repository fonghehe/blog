---
title: "Vue 2.5 新機能実践：TypeScript サポートとエラーハンドリングの改善"
date: 2018-01-02 16:03:54
tags:
  - Vue
readingTime: 1
description: "Vue 2.5 では TypeScript サポートの大幅な改善と新しいエラーハンドリングフックが追加されました。"
---

Vue 2.5 では TypeScript サポートの大幅な改善と新しいエラーハンドリングフックが追加されました。

## Vue.extend による TypeScript サポートの向上

```typescript
// Vue 2.5 以前：デコレータ構文
import Vue from "vue";
import Component from "vue-class-component";

@Component({
  template: '<button @click="onClick">クリック！</button>',
})
class MyComponent extends Vue {
  message: string = "こんにちは！";
  onClick() {
    window.alert(this.message);
  }
}

// Vue 2.5+：Vue.extend が TypeScript でより良く動作
import Vue from "vue";

const MyComponent = Vue.extend({
  data() {
    return {
      message: "こんにちは！" as string,
    };
  },
  methods: {
    greet(): void {
      console.log(this.message); // 正しく型付けされる
    },
  },
});
```

`Vue.extend()` の型推論が大幅に改善されました。デコレータなしで `this.message`、`this.$data`、`this.$store` すべてに正しい型が付きます。

## 関数型コンポーネントの改善

状態なし、`this` なしの関数型コンポーネントが TypeScript でより良いサポートを得ました：

```typescript
import { FunctionalComponentOptions } from "vue";

const FancyList: FunctionalComponentOptions = {
  functional: true,
  props: {
    items: Array,
  },
  render(createElement, context) {
    return createElement(
      "ul",
      context.props.items.map((item) => createElement("li", item.name)),
    );
  },
};
```

## errorCaptured フック

Vue 2.5 では `errorCaptured` が導入されました — React のエラーバウンダリに相当する Vue の機能です：

```javascript
export default {
  name: "ErrorWrapper",
  data() {
    return { error: null };
  },
  errorCaptured(err, vm, info) {
    // err: エラーオブジェクト
    // vm: エラーが発生したコンポーネント
    // info: エラーがキャッチされた場所の説明文字列
    this.error = err.message;
    // false を返すとエラーの伝播を止める
    return false;
  },
};
```

使用例：

```html
<template>
  <div>
    <div v-if="error" class="error-display">
      コンポーネントエラー：{{ error }}
    </div>
    <slot v-else />
  </div>
</template>
```

エラーはコンポーネントツリーを伝播し、`errorCaptured` で `false` を返すコンポーネントで止まります。

## v-on による複数イベントリスナー

```html
<!-- Vue 2.5 以前：繰り返しの v-on -->
<input v-on:focus="onFocus" v-on:blur="onBlur" v-on:input="onInput" />

<!-- Vue 2.5+：v-on にオブジェクト構文 -->
<input v-on="{ focus: onFocus, blur: onBlur, input: onInput }" />
```

これは全てのイベントリスナーをスルーする必要がある高階コンポーネントを構築する際に特に便利です。
