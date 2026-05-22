---
title: "Vue 事件總線：組件間通信"
date: 2018-05-19 10:45:27
tags:
  - Vue
readingTime: 1
description: "Vue 的組件通信有父子通信（props/emit）、Vuex（全局狀態）兩個主要方案，還有一個輕量方案：事件總線（Event Bus）。適合兄弟組件間或跨層級的簡單通信。"
wordCount: 178
---

Vue 的組件通信有父子通信（props/emit）、Vuex（全局狀態）兩個主要方案，還有一個輕量方案：事件總線（Event Bus）。適合兄弟組件間或跨層級的簡單通信。

## 創建事件總線

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
// 組件 A：發送事件
import { EventBus } from '@/utils/eventBus'

export default {
  methods: {
    handleLogin(user) {
      EventBus.$emit('user:login', user)
    }
  }
}

// 組件 B：監聽事件
import { EventBus } from '@/utils/eventBus'

export default {
  created() {
    EventBus.$on('user:login', this.handleUserLogin)
  },
  beforeDestroy() {
    // ⚠️ 必須在銷燬前取消監聽！否則內存泄漏
    EventBus.$off('user:login', this.handleUserLogin)
  },
  methods: {
    handleUserLogin(user) {
      console.log('用户登錄了：', user.name)
    }
  }
}
```

## 用 Vue.prototype.$bus

```javascript
// 組件 A
this.$bus.$emit("refresh-list");

// 組件 B
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

**必須在 beforeDestroy 裏 off**：

```javascript
// ❌ 隻 $on 不 $off：組件銷燬後，監聽還存在
// 重新進入這個組件會註冊第二個監聽器，觸發兩次
// 來回幾次就會觸發很多次，也是內存泄漏

// ✅ 配對使用
created() {
  this.$bus.$on('event', this.handler)
},
beforeDestroy() {
  this.$bus.$off('event', this.handler)
  // 注意：必須傳函數引用，不能傳匿名函數
  // 下面這樣 $off 不生效：
  // this.$bus.$off('event', () => this.handler()) ← 不是同一個函數
}
```

## 和 Vuex 的選擇

```
事件總線適合：
  - 兩三個組件之間的簡單通信
  - 不需要持久化的一次性通知
  - 快速原型開發

Vuex 適合：
  - 多個組件需要共享的狀態
  - 需要時間旅行調試
  - 狀態需要持久化
  - 團隊協作，需要清晰的數據流
```

如果用事件總線傳遞的事件越來越多，説明是時候遷移到 Vuex 了。

## 小結

- Event Bus 本質是一個空的 Vue 實例，用作事件發佈/訂閲
- `$emit` 發送，`$on` 監聽，`$off` 取消
- 組件銷燬時必須 `$off`，否則內存泄漏
- 適合簡單的組件間通信，複雜場景用 Vuex