---
title: "Vue 组件通信的六种方式"
date: 2018-02-10 09:39:52
tags:
  - Vue
readingTime: 2
description: "Vue 里组件通信是绕不开的话题。不同场景适合不同方案，把六种方式整理在一起，方便查阅。"
wordCount: 457
---

Vue 里组件通信是绕不开的话题。不同场景适合不同方案，把六种方式整理在一起，方便查阅。

## 1. Props / $emit（父子通信）

最基础的方式，父传子用 props，子传父用 emit：

```vue
<!-- 父组件 -->
<template>
  <ChildComponent :title="pageTitle" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { pageTitle: "我的页面" };
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
<!-- 子组件 -->
<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('update', '新标题')">改标题</button>
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

**适用场景**：直接父子关系，逻辑简单。

## 2. v-model（父子双向绑定语法糖）

`v-model` 本质是 `:value + @input` 的语法糖：

```vue
<!-- 父组件 -->
<CustomInput v-model="searchText" />
<!-- 等价于 -->
<CustomInput :value="searchText" @input="searchText = $event" />
```

```vue
<!-- 子组件 CustomInput.vue -->
<template>
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ["value"],
};
</script>
```

**适用场景**：表单控件、输入类组件。

## 3. $parent / $children（直接访问实例）

```javascript
// 子组件访问父组件
this.$parent.someData = "changed";
this.$parent.someMethod();

// 父组件访问子组件
this.$children[0].childMethod();
// 更好的方式是用 $refs
this.$refs.myChild.childMethod();
```

**⚠️ 不推荐**：耦合严重，重构困难。了解即可，实际项目尽量避免。

## 4. $attrs / $listeners（跨层透传）

Vue 2.4 引入的，解决"隔代传递"的问题，不用每层都写 props：

```vue
<!-- 爷组件 -->
<ChildWrapper :user-id="123" :theme="'dark'" @save="handleSave" />
```

```vue
<!-- 中间层（不关心这些 props，只透传） -->
<template>
  <GrandChild v-bind="$attrs" v-on="$listeners" />
</template>

<script>
export default {
  inheritAttrs: false, // 阻止 attrs 自动绑定到根元素
};
</script>
```

```vue
<!-- 孙组件 -->
<script>
export default {
  props: ["userId", "theme"], // 可以直接声明来自爷组件的 props
};
</script>
```

**适用场景**：封装高阶组件，透传属性给底层组件。

## 5. provide / inject（依赖注入）

祖先组件提供数据，任意后代组件注入：

```javascript
// 祖先组件
export default {
  provide() {
    return {
      theme: "dark",
      getUser: this.getUser, // 可以提供方法
    };
  },
};
```

```javascript
// 任意后代组件（不管嵌套多深）
export default {
  inject: ["theme", "getUser"],
  mounted() {
    console.log(this.theme); // 'dark'
  },
};
```

注意：`provide` 的数据**默认不是响应式的**。如果要响应式，需要传递 reactive 对象或使用 `Vue.observable`。

**适用场景**：组件库（如 Form 把校验规则注入 FormItem）、主题传递。

## 6. EventBus / Vuex（跨组件通信）

### EventBus（简单场景）

```javascript
// event-bus.js
import Vue from "vue";
export const bus = new Vue();
```

```javascript
// 组件 A（发送事件）
import { bus } from "./event-bus";
bus.$emit("user-updated", { name: "Alice" });
```

```javascript
// 组件 B（监听事件）
import { bus } from "./event-bus";

export default {
  created() {
    bus.$on("user-updated", (user) => {
      this.currentUser = user;
    });
  },
  beforeDestroy() {
    bus.$off("user-updated"); // 记得清理！
  },
};
```

**适用场景**：小型应用，偶发的跨组件事件。不要滥用，否则数据流向难以追踪。

### Vuex（复杂场景）

状态需要多个组件共享、需要时间旅行调试、业务逻辑复杂时，上 Vuex。

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

## 如何选择

| 场景                 | 推荐方案            |
| 
-------------------- | ------------------- |
| 直接父子             | props / emit        |
| 表单控件             | v-model             |
| 深层嵌套的组件库内部 | provide / inject    |
| 封装高阶组件         | $attrs / $listeners |
| 小型应用跨组件事件   | EventBus            |
| 中大型应用共享状态   | Vuex                |

原则：**够用就好，不过度设计**。三层以内的组件通信用 props/emit，更复杂的情况才考虑其他方案。
