---
title: "Vue 3 Beta Update Tracker"
date: 2019-10-10 16:50:19
tags:
  - Vue
readingTime: 3
description: "Since Vue 3 was announced as a rewrite at VueConf 2018, it has been progressing steadily. As of now, Vue 3 has entered the Beta stage and its core APIs are stabilizing. This article rounds up the major changes in Vue 3 to help Vue 2 developers get a head start on what's coming."
wordCount: 388
---

Since Vue 3 was announced as a rewrite at VueConf 2018, it has been progressing steadily. As of now, Vue 3 has entered the Beta stage and its core APIs are stabilizing. This article rounds up the major changes in Vue 3 to help Vue 2 developers get a head start on what's coming.

## Why Rewrite?

After a few years of growth, the Vue 2 codebase revealed several architectural limitations:

1. **Code organization**: the Options API scatters related logic across different options, making large components hard to maintain
2. **Type inference**: the object-based Options API offers limited TypeScript support
3. **Performance bottleneck**: the virtual DOM's diff algorithm compares everything, unable to skip static content
4. **Bundle size**: no Tree Shaking support, so the entire runtime gets bundled

Vue 3 was rewritten from the ground up and addresses all of the above.

## Composition API

The Composition API is the most important new feature in Vue 3. It provides a set of function-based APIs for organizing component logic:

```js
// Vue 2 Options API
export default {
  data() {
    return { count: 0, user: null, loading: false };
  },
  computed: {
    doubleCount() { return this.count * 2; }
  },
  methods: {
    increment() { this.count++; },
    async fetchUser(id) {
      this.loading = true;
      this.user = await api.getUser(id);
      this.loading = false;
    }
  },
  mounted() {
    this.fetchUser(this.$route.params.id);
  }
};

// Vue 3 Composition API
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

export default {
  setup() {
    const count = ref(0);
    const doubleCount = computed(() => count.value * 2);

    function increment() { count.value++; }

    const route = useRoute();
    const user = ref(null);
    const loading = ref(false);

    async function fetchUser(id) {
      loading.value = true;
      user.value = await api.getUser(id);
      loading.value = false;
    }

    onMounted(() => fetchUser(route.params.id));

    return { count, doubleCount, increment, user, loading };
  }
};
```

### `ref` and `reactive`

```js
import { ref, reactive } from 'vue';

// ref: 包装基本类型
const count = ref(0);
console.log(count.value); // 0
count.value++;

// reactive: 创建响应式对象
const state = reactive({
  name: '张三',
  age: 25
});

// 模板中不需要 .value
```

### Extracting Reusable Logic: Composables

```js
// composables/useMousePosition.js
import { ref, onMounted, onUnmounted } from 'vue';

export function useMousePosition() {
  const x = ref(0);
  const y = ref(0);

  function update(e) {
    x.value = e.pageX;
    y.value = e.pageY;
  }

  onMounted(() => window.addEventListener('mousemove', update));
  onUnmounted(() => window.removeEventListener('mousemove', update));

  return { x, y };
}

// composables/useFetch.js
import { ref } from 'vue';

export function useFetch(url) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(false);

  async function execute() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(
        typeof url === 'function' ? url() : url.value
      );
      data.value = await response.json();
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  return { data, error, loading, execute };
}
```

Using it in a component:

```vue
{% raw %}
<template>
  <div>
    <p>鼠标位置: {{ x }}, {{ y }}</p>
    <input v-model="keyword" placeholder="搜索..." />
    <div v-if="loading">加载中...</div>
    <ul v-else>
      <li v-for="item in results" :key="item.id">{{ item.name }}</li>
    </ul>
  </div>
</template>

<script>
import { ref, watch } from 'vue';
import { useMousePosition } from '../composables/useMousePosition';
import { useFetch } from '../composables/useFetch';

export default {
  setup() {
    const { x, y } = useMousePosition();
    const keyword = ref('');
    const { data: results, loading, execute: search } = useFetch(
      () => `/api/search?q=${keyword.value}`
    );

    watch(keyword, (val) => { if (val) search(); });

    return { x, y, keyword, results, loading };
  }
};
</script>
{% endraw %}
```

## New Reactivity System

Vue 3 uses `Proxy` instead of `Object.defineProperty`:

```js
import { reactive, watch, watchEffect } from 'vue';

// 1. 可以监听新增属性
const state = reactive({ count: 0 });
state.name = '新属性'; // 自动变为响应式

// 2. 可以监听数组索引
const list = reactive([1, 2, 3]);
list[0] = 100; // 自动变为响应式

// 3. 可以监听 Map、Set 等
const map = reactive(new Map());
map.set('key', 'value');

// watchEffect: 自动追踪依赖
watchEffect(() => {
  console.log(`count is: ${state.count}`);
});
```

## Faster Virtual DOM

The Vue 3 compiler performs static analysis on templates and generates optimized render code:

```js
// 静态节点被提升到渲染函数外部
const _hoisted_1 = /*#__PURE__*/ createVNode("h1", null, "标题", -1);

function render(_ctx, _cache) {
  return (_openBlock(), _createBlock("div", null, [
    _hoisted_1,  // 静态节点直接复用
    _createVNode("p", null, _toDisplayString(_ctx.text), 1 /* TEXT */)
  ]));
}
```

The key optimizations include:

1. **Static Hoisting**: static nodes are created only once
2. **Patch Flags**: the compiler tags dynamic nodes so diffing only compares the tagged parts
3. **Block Tree**: fragments containing dynamic nodes are hoisted into Blocks
4. **Cached event handlers**: inline event handlers are cached

## Fragment, Teleport and Suspense

### Fragment

A Vue 3 component can have multiple root nodes:

```vue
<template>
  <header>页头</header>
  <main>内容</main>
  <footer>页脚</footer>
</template>
```

### Teleport

Renders a child component to a different location in the DOM tree:

```vue
<template>
  <button @click="showModal = true">打开弹窗</button>
  <Teleport to="body">
    <Modal v-if="showModal" @close="showModal = false">
      <h2>弹窗标题</h2>
    </Modal>
  </Teleport>
</template>
```

### Suspense

Handles the loading state of async components:

```vue
<template>
  <Suspense>
    <template #default>
      <AsyncUserProfile :userId="userId" />
    </template>
    <template #fallback>
      <div>加载中...</div>
    </template>
  </Suspense>
</template>
```

## Modular Internal Architecture

Vue 3 adopts a monorepo, and its core modules can be used independently:

```
@vue/reactivity     // 响应式系统
@vue/runtime-core   // 核心运行时
@vue/runtime-dom    // DOM 运行时
@vue/compiler-core  // 核心编译器
@vue/compiler-dom   // DOM 编译器
vue                 // 完整版本
```

The reactivity system can be used on its own:

```js
import { reactive, watchEffect } from '@vue/reactivity';

const state = reactive({ count: 0 });
watchEffect(() => console.log(state.count));
state.count++; // 输出: 1
```

## Summary

- Vue 3 introduces the Composition API, offering function-based logic organization and reuse
- It uses Proxy instead of Object.defineProperty, supporting array indexing, added properties, and Map/Set
- Compiler optimizations (static hoisting, Patch Flags, Block Tree) greatly improve render performance
- New built-in components like Fragment, Teleport, and Suspense were added
- The modular architecture lets the reactivity system be used standalone
- It has better TypeScript support
- The Options API is still fully supported, so migration can be gradual
