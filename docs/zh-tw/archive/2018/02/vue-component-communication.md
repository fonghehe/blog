---
title: "Vue 元件通訊的六種方式"
date: 2018-02-10 09:39:52
tags:
  - Vue
readingTime: 2
description: "Vue 裡元件通訊是繞不開的話題。不同場景適合不同方案，把六種方式整理在一起，方便查閱。"
wordCount: 461
---

Vue 裡元件通訊是繞不開的話題。不同場景適合不同方案，把六種方式整理在一起，方便查閱。

## 1. Props / $emit（父子通訊）

最基礎的方式，父傳子用 props，子傳父用 emit：

```vue
<!-- 父元件 -->
<template>
  <ChildComponent :title="pageTitle" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { pageTitle: "我的頁面" };
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
<!-- 子元件 -->
<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('update', '新標題')">改標題</button>
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

**適用場景**：直接父子關係，邏輯簡單。

## 2. v-model（父子雙向繫結語法糖）

`v-model` 本質是 `:value + @input` 的語法糖：

```vue
<!-- 父元件 -->
<CustomInput v-model="searchText" />
<!-- 等價於 -->
<CustomInput :value="searchText" @input="searchText = $event" />
```

```vue
<!-- 子元件 CustomInput.vue -->
<template>
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ["value"],
};
</script>
```

**適用場景**：表單控制元件、輸入類元件。

## 3. $parent / $children（直接訪問例項）

```javascript
// 子元件訪問父元件
this.$parent.someData = "changed";
this.$parent.someMethod();

// 父元件訪問子元件
this.$children[0].childMethod();
// 更好的方式是用 $refs
this.$refs.myChild.childMethod();
```

**⚠️ 不推薦**：耦合嚴重，重構困難。瞭解即可，實際專案儘量避免。

## 4. $attrs / $listeners（跨層透傳）

Vue 2.4 引入的，解決"隔代傳遞"的問題，不用每層都寫 props：

```vue
<!-- 爺元件 -->
<ChildWrapper :user-id="123" :theme="'dark'" @save="handleSave" />
```

```vue
<!-- 中間層（不關心這些 props，只透傳） -->
<template>
  <GrandChild v-bind="$attrs" v-on="$listeners" />
</template>

<script>
export default {
  inheritAttrs: false, // 阻止 attrs 自動繫結到根元素
};
</script>
```

```vue
<!-- 孫元件 -->
<script>
export default {
  props: ["userId", "theme"], // 可以直接宣告來自爺元件的 props
};
</script>
```

**適用場景**：封裝高階元件，透傳屬性給底層元件。

## 5. provide / inject（依賴注入）

祖先元件提供資料，任意後代元件注入：

```javascript
// 祖先元件
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
// 任意後代元件（不管巢狀多深）
export default {
  inject: ["theme", "getUser"],
  mounted() {
    console.log(this.theme); // 'dark'
  },
};
```

注意：`provide` 的資料**預設不是響應式的**。如果要響應式，需要傳遞 reactive 物件或使用 `Vue.observable`。

**適用場景**：元件庫（如 Form 把校驗規則注入 FormItem）、主題傳遞。

## 6. EventBus / Vuex（跨元件通訊）

### EventBus（簡單場景）

```javascript
// event-bus.js
import Vue from "vue";
export const bus = new Vue();
```

```javascript
// 元件 A（傳送事件）
import { bus } from "./event-bus";
bus.$emit("user-updated", { name: "Alice" });
```

```javascript
// 元件 B（監聽事件）
import { bus } from "./event-bus";

export default {
  created() {
    bus.$on("user-updated", (user) => {
      this.currentUser = user;
    });
  },
  beforeDestroy() {
    bus.$off("user-updated"); // 記得清理！
  },
};
```

**適用場景**：小型應用，偶發的跨元件事件。不要濫用，否則資料流向難以追蹤。

### Vuex（複雜場景）

狀態需要多個元件共享、需要時間旅行除錯、業務邏輯複雜時，上 Vuex。

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

## 如何選擇

| 場景                 | 推薦方案            |
| 
-------------------- | ------------------- |
| 直接父子             | props / emit        |
| 表單控制元件             | v-model             |
| 深層巢狀的元件庫內部 | provide / inject    |
| 封裝高階元件         | $attrs / $listeners |
| 小型應用跨元件事件   | EventBus            |
| 中大型應用共享狀態   | Vuex                |

原則：**夠用就好，不過度設計**。三層以內的元件通訊用 props/emit，更復雜的情況才考慮其他方案。
