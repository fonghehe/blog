---
title: "Vue 2.5 新特性實踐：TypeScript 支援同錯誤處理改進"
date: 2018-01-02 16:03:54
tags:
  - Vue
readingTime: 2
description: "Vue 2.5 喺 2017 年 10 月發布，帶嚟咗幾個對日常開發影響較大嘅改進。用咗兩個月後，總結一下實際使用體驗。"
wordCount: 476
---

Vue 2.5 喺 2017 年 10 月發布，帶嚟咗幾個對日常開發影響較大嘅改進。用咗兩個月後，總結一下實際使用體驗。

## 更好嘅 TypeScript 支援

呢個係 2.5 最值得關注嘅更新。之前用 TypeScript 寫 Vue 組件，必須依賴 `vue-class-component` 裝飾器語法，體驗比較割裂。2.5 之後，Vue 嘅類型定義做咗大幅改進，即使唔用 class 風格都能夠獲得不錯嘅類型推斷。

```typescript
// 現在可以直接用 Vue.extend 獲得類型檢查
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

`this` 上嘅屬性現在有咗正確嘅類型推斷，喺方法裡面訪問 `this.message` 唔再係 `any`。

## 函數式組件嘅改進

2.5 之前，函數式組件（functional component）隻支援單檔案組件（SFC）形式，範本裡面無法直接用。現在可以喺範本裡面聲明函數式組件喇：

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

函數式組件冇響應式狀態，冇生命週期，渲染開銷更小。適合純展示型嘅葉子組件。

## errorCaptured 鉤子

呢個係我覺得最實用嘅新特性。之前一個子組件嘅渲染錯誤會直接令整個應用崩潰，冇任何攔截機製。2.5 引入咗 `errorCaptured` 生命週期鉤子：

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

配合模板裡面嘅條件渲染，可以做出類似 React Error Boundary 嘅效果：

```html
<template>
  <div>
    <div v-if="hasError" class="error-fallback">
      <p>組件加載失敗，請刷新重試</p>
    </div>
    <slot v-else></slot>
  </div>
</template>
```

喺業務代碼裡面，將唔穩定嘅第三方組件或動態加載嘅組件包裹喺呢個 ErrorBoundary 裡面，避免單點故障影響全局。

## v-on 多事件處理

一個小改進，但幾常用：

```html
<!-- 之前需要寫兩個 v-on -->
<input @keyup.enter="submit" @keyup.esc="cancel" />

<!-- 2.5 可以咁寫 -->
<button v-on="{ mousedown: doThis, mouseup: doThat }"></button>
```

對於需要動態綁定多個事件嘅場景，代碼更簡潔。

## 升級建議

如果你嘅項目仲喺 Vue 2.4，升級到 2.5 基本冇破壞性變更，直接跑 `npm update vue` 就得。如果喺用 TypeScript，配合更新 `@types/vue` 後，IDE 嘅補全體驗會有明顯提升。

---

_下一篇：Webpack 3 代碼分割實踐_
