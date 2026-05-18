---
title: "Vue 2.5 新特性實踐：TypeScript 支援與錯誤處理改進"
date: 2018-01-02 16:03:54
tags:
  - Vue
readingTime: 2
description: "Vue 2.5 在 2017 年 10 月發布，帶來了幾個對日常開發影響較大的改進。用了兩個月後，總結一下實際使用體驗。"
---

Vue 2.5 在 2017 年 10 月發布，帶來了幾個對日常開發影響較大的改進。用了兩個月後，總結一下實際使用體驗。

## 更好的 TypeScript 支援

這是 2.5 最值得關注的更新。之前用 TypeScript 寫 Vue 元件，必須依賴 `vue-class-component` 裝飾器語法，體驗比較割裂。2.5 之後，Vue 的型別定義做了大幅改進，即使不用 class 風格也能獲得不錯的型別推斷。

```typescript
// 現在可以直接用 Vue.extend 獲得型別檢查
import Vue from "vue";

export default Vue.extend({
  data() {
    return {
      message: "Hello",
      count: 0,
    };
  },
  computed: {
    doubleCount(): number {
      return this.count * 2;
    },
  },
  methods: {
    increment() {
      this.count++;
    },
  },
});
```

`this` 上的屬性現在有了正確的型別推斷，在方法裡存取 `this.message` 不再是 `any`。

## 函式元件的改進

2.5 之前，函式元件（functional component）只支援單一檔案元件（SFC）形式，範本裡無法直接用。現在可以在範本裡宣告函式元件了：

```html
{% raw %}
<template functional>
  <div class="user-card">
    <h3>{{ props.name }}</h3>
    <p>{{ props.email }}</p>
  </div>
</template>

<script>
  export default {
    functional: true,
    props: {
      name: String,
      email: String,
    },
  };
</script>
{% endraw %}
```

函式元件沒有響應式狀態，沒有生命週期，渲染開銷更小。適合純展示型的葉子元件。

## errorCaptured 鉤子

這是我覺得最實用的新特性。之前一個子元件的渲染錯誤會直接讓整個應用崩潰，沒有任何攔截機制。2.5 引入了 `errorCaptured` 生命週期鉤子：

```javascript
export default {
  name: "ErrorBoundary",
  data() {
    return {
      hasError: false,
      error: null,
    };
  },
  errorCaptured(err, vm, info) {
    this.hasError = true;
    this.error = err;
    // 返回 false 可以阻止錯誤繼續向上傳播
    return false;
  },
};
```

搭配範本裡的條件渲染，可以做出類似 React Error Boundary 的效果：

```html
<template>
  <div>
    <div v-if="hasError" class="error-fallback">
      <p>元件載入失敗，請重新整理後再試</p>
    </div>
    <slot v-else></slot>
  </div>
</template>
```

在業務程式碼裡，把不穩定的第三方元件或動態載入的元件包裹在這個 ErrorBoundary 裡，避免單點故障影響全域。

## v-on 多事件處理

一個小改進，但挺常用：

```html
<!-- 之前需要寫兩個 v-on -->
<input @keyup.enter="submit" @keyup.esc="cancel" />

<!-- 2.5 可以這樣寫 -->
<button v-on="{ mousedown: doThis, mouseup: doThat }"></button>
```

對於需要動態繫結多個事件的場景，程式碼更簡潔。

## 升級建議

如果你的專案還在 Vue 2.4，升級到 2.5 基本沒有破壞性變更，直接跑 `npm update vue` 就行。如果在用 TypeScript，配合更新 `@types/vue` 後，IDE 的補全體驗會有明顯提升。

---

_下一篇：Webpack 3 程式碼分割實踐_
