---
title: "Vue 事件匯流排：元件間通訊"
date: 2018-05-19 10:45:27
tags:
  - Vue
readingTime: 1
description: "Vue 的元件通訊有父子通訊（props/emit）、Vuex（全域性狀態）兩個主要方案，還有一個輕量方案：事件匯流排（Event Bus）。適合兄弟元件間或跨層級的簡單通訊。"
wordCount: 183
---

Vue 的元件通訊有父子通訊（props/emit）、Vuex（全域性狀態）兩個主要方案，還有一個輕量方案：事件匯流排（Event Bus）。適合兄弟元件間或跨層級的簡單通訊。

## 建立事件匯流排

```javascript
// src/utils/eventBus.js
import Vue from "vue";
export const EventBus = new Vue();
```

或者掛到 Vue 原型上：

```javascript
// main.js
import Vue from "vue";
Vue.prototype.$bus = new Vue();
```

## 基本用法

```javascript
// 元件 A：傳送事件
import { EventBus } from '@/utils/eventBus'

export default {
  methods: {
    handleLogin(user) {
      EventBus.$emit('user:login', user)
    }
  }
}

// 元件 B：監聽事件
import { EventBus } from '@/utils/eventBus'

export default {
  created() {
    EventBus.$on('user:login', this.handleUserLogin)
  },
  beforeDestroy() {
    // ⚠️ 必須在銷燬前取消監聽！否則記憶體洩漏
    EventBus.$off('user:login', this.handleUserLogin)
  },
  methods: {
    handleUserLogin(user) {
      console.log('使用者登入了：', user.name)
    }
  }
}
```

## 用 Vue.prototype.$bus

```javascript
// 元件 A
this.$bus.$emit("refresh-list");

// 元件 B
export default {
  created() {
    this.$bus.$on("refresh-list", this.loadList);
  },
  beforeDestroy() {
    this.$bus.$off("refresh-list", this.loadList);
  },
};
```

## 注意事項

**必須在 beforeDestroy 裡 off**：

```javascript
// ❌ 隻 $on 不 $off：元件銷燬後，監聽還存在
// 重新進入這個元件會註冊第二個監聽器，觸發兩次
// 來回幾次就會觸發很多次，也是記憶體洩漏

// ✅ 配對使用
created() {
  this.$bus.$on('event', this.handler)
},
beforeDestroy() {
  this.$bus.$off('event', this.handler)
  // 注意：必須傳函式引用，不能傳匿名函式
  // 下面這樣 $off 不生效：
  // this.$bus.$off('event', () => this.handler()) ← 不是同一個函式
}
```

## 和 Vuex 的選擇

```
事件匯流排適合：
  - 兩三個元件之間的簡單通訊
  - 不需要持久化的一次性通知
  - 快速原型開發

Vuex 適合：
  - 多個元件需要共享的狀態
  - 需要時間旅行除錯
  - 狀態需要持久化
  - 團隊協作，需要清晰的資料流
```

如果用事件匯流排傳遞的事件越來越多，說明是時候遷移到 Vuex 了。

## 小結

- Event Bus 本質是一個空的 Vue 例項，用作事件釋出/訂閱
- `$emit` 傳送，`$on` 監聽，`$off` 取消
- 元件銷燬時必須 `$off`，否則記憶體洩漏
- 適合簡單的元件間通訊，複雜場景用 Vuex