---
title: "Vue 事件总线：组件间通信"
date: 2018-05-19 10:45:27
tags:
  - Vue
readingTime: 1
description: "Vue 的组件通信有父子通信（props/emit）、Vuex（全局状态）两个主要方案，还有一个轻量方案：事件总线（Event Bus）。适合兄弟组件间或跨层级的简单通信。"
wordCount: 178
---

Vue 的组件通信有父子通信（props/emit）、Vuex（全局状态）两个主要方案，还有一个轻量方案：事件总线（Event Bus）。适合兄弟组件间或跨层级的简单通信。

## 创建事件总线

```javascript
// src/utils/eventBus.js
import Vue from "vue";
export const EventBus = new Vue();
```

或者挂到 Vue 原型上：

```javascript
// main.js
import Vue from "vue";
Vue.prototype.$bus = new Vue();
```

## 基本用法

```javascript
// 组件 A：发送事件
import { EventBus } from '@/utils/eventBus'

export default {
  methods: {
    handleLogin(user) {
      EventBus.$emit('user:login', user)
    }
  }
}

// 组件 B：监听事件
import { EventBus } from '@/utils/eventBus'

export default {
  created() {
    EventBus.$on('user:login', this.handleUserLogin)
  },
  beforeDestroy() {
    // ⚠️ 必须在销毁前取消监听！否则内存泄漏
    EventBus.$off('user:login', this.handleUserLogin)
  },
  methods: {
    handleUserLogin(user) {
      console.log('用户登录了：', user.name)
    }
  }
}
```

## 用 Vue.prototype.$bus

```javascript
// 组件 A
this.$bus.$emit("refresh-list");

// 组件 B
export default {
  created() {
    this.$bus.$on("refresh-list", this.loadList);
  },
  beforeDestroy() {
    this.$bus.$off("refresh-list", this.loadList);
  },
};
```

## 注意事项

**必须在 beforeDestroy 里 off**：

```javascript
// ❌ 只 $on 不 $off：组件销毁后，监听还存在
// 重新进入这个组件会注册第二个监听器，触发两次
// 来回几次就会触发很多次，也是内存泄漏

// ✅ 配对使用
created() {
  this.$bus.$on('event', this.handler)
},
beforeDestroy() {
  this.$bus.$off('event', this.handler)
  // 注意：必须传函数引用，不能传匿名函数
  // 下面这样 $off 不生效：
  // this.$bus.$off('event', () => this.handler()) ← 不是同一个函数
}
```

## 和 Vuex 的选择

```
事件总线适合：
  - 两三个组件之间的简单通信
  - 不需要持久化的一次性通知
  - 快速原型开发

Vuex 适合：
  - 多个组件需要共享的状态
  - 需要时间旅行调试
  - 状态需要持久化
  - 团队协作，需要清晰的数据流
```

如果用事件总线传递的事件越来越多，说明是时候迁移到 Vuex 了。

## 小结

- Event Bus 本质是一个空的 Vue 实例，用作事件发布/订阅
- `$emit` 发送，`$on` 监听，`$off` 取消
- 组件销毁时必须 `$off`，否则内存泄漏
- 适合简单的组件间通信，复杂场景用 Vuex