---
title: "Six Ways to Communicate Between Vue Components"
date: 2018-02-10 09:39:52
tags:
  - Vue
readingTime: 2
description: "Component communication in Vue is an unavoidable topic. Different scenarios suit different approaches. Here's a summary of all six methods for quick reference."
wordCount: 275
---

Component communication in Vue is an unavoidable topic. Different scenarios suit different approaches. Here's a summary of all six methods for quick reference.

## 1. Props / $emit (Parent-Child)

The most fundamental approach: props for parent-to-child, emit for child-to-parent:

```vue
<!-- Parent component -->
<template>
  <ChildComponent :title="pageTitle" @update="handleUpdate" />
</template>

<script>
export default {
  data() {
    return { pageTitle: "My Page" };
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
<!-- Child component -->
<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('update', 'New Title')">Change Title</button>
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

**Best for**: direct parent-child relationships with simple logic.

## 2. v-model (Parent-Child Two-Way Binding Sugar)

`v-model` is syntactic sugar for `:value + @input`:

```vue
<!-- Parent component -->
<CustomInput v-model="searchText" />
<!-- Equivalent to -->
<CustomInput :value="searchText" @input="searchText = $event" />
```

```vue
<!-- Child component CustomInput.vue -->
<template>
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ["value"],
};
</script>
```

**Best for**: form controls and input components.

## 3. $parent / $children (Direct Instance Access)

```javascript
// Child accessing parent
this.$parent.someData = "changed";
this.$parent.someMethod();

// Parent accessing child
this.$children[0].childMethod();
// Better way: use $refs
this.$refs.myChild.childMethod();
```

**⚠️ Not recommended**: tight coupling makes refactoring difficult. Good to know, but avoid in real projects.

## 4. $attrs / $listeners (Cross-Layer Pass-Through)

Introduced in Vue 2.4 to solve the "grandchild pass-through" problem without needing props at every layer:

```vue
<!-- Grandparent component -->
<ChildWrapper :user-id="123" :theme="'dark'" @save="handleSave" />
```

```vue
<!-- Middle layer (doesn't care about these props, just passes them through) -->
<template>
  <GrandChild v-bind="$attrs" v-on="$listeners" />
</template>

<script>
export default {
  inheritAttrs: false, // prevent attrs from auto-binding to the root element
};
</script>
```

```vue
<!-- Grandchild component -->
<script>
export default {
  props: ["userId", "theme"], // can directly declare props from grandparent
};
</script>
```

**Best for**: wrapping higher-order components, passing attributes to underlying components.

## 5. provide / inject (Dependency Injection)

Ancestor provides data; any descendant can inject it:

```javascript
// Ancestor component
export default {
  provide() {
    return {
      theme: "dark",
      getUser: this.getUser, // methods can be provided too
    };
  },
};
```

```javascript
// Any descendant component (no matter how deeply nested)
export default {
  inject: ["theme", "getUser"],
  mounted() {
    console.log(this.theme); // 'dark'
  },
};
```

Note: `provide` data is **not reactive by default**. For reactivity, pass a reactive object or use `Vue.observable`.

**Best for**: component libraries (e.g. Form injecting validation rules into FormItem), theme passing.

## 6. EventBus / Vuex (Cross-Component Communication)

### EventBus (Simple Cases)

```javascript
// event-bus.js
import Vue from "vue";
export const bus = new Vue();
```

```javascript
// Component A (emitting)
import { bus } from "./event-bus";
bus.$emit("user-updated", { name: "Alice" });
```

```javascript
// Component B (listening)
import { bus } from "./event-bus";

export default {
  created() {
    bus.$on("user-updated", (user) => {
      this.currentUser = user;
    });
  },
  beforeDestroy() {
    bus.$off("user-updated"); // don't forget to clean up!
  },
};
```

**Best for**: small applications, occasional cross-component events. Don't overuse — it makes data flow hard to trace.

### Vuex (Complex Cases)

Use Vuex when state needs to be shared across many components, you need time-travel debugging, or business logic is complex.

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

## How to Choose

| Scenario                            | Recommended         |
| ----------------------------------- | ------------------- |
| Direct parent-child                 | props / emit        |
| Form controls                       | v-model             |
| Deep nesting inside component libs  | provide / inject    |
| Wrapping higher-order components    | $attrs / $listeners |
| Cross-component events in small app | EventBus            |
| Shared state in medium/large app    | Vuex                |

Principle: **use what's sufficient, don't over-engineer**. For communication within three levels, use props/emit. Only consider other approaches for more complex cases.
