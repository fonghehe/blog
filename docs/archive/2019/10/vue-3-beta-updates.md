---
title: "Vue 3 Beta 更新内容跟踪"
date: 2019-10-10 16:50:19
tags:
  - Vue
readingTime: 4
description: "Vue 3 自 2018 年 VueConf 上宣布重写以来，一直在稳步推进。截至目前，Vue 3 已经进入 Beta 阶段，核心 API 趋于稳定。本文整理 Vue 3 的主要变化，帮助 Vue 2 开发者提前了解即将到来的变化。"
wordCount: 576
---

Vue 3 自 2018 年 VueConf 上宣布重写以来，一直在稳步推进。截至目前，Vue 3 已经进入 Beta 阶段，核心 API 趋于稳定。本文整理 Vue 3 的主要变化，帮助 Vue 2 开发者提前了解即将到来的变化。

## 为什么要重写

Vue 2 的代码库经过几年发展，暴露了一些架构上的限制：

1. **代码组织**：Options API 使得相关逻辑分散在不同选项中，大型组件难以维护
2. **类型推导**：Options API 的对象写法对 TypeScript 支持有限
3. **性能瓶颈**：虚拟 DOM 的 diff 算法是全量比较，无法跳过静态内容
4. **体积**：不支持 Tree Shaking，打包整个运行时

Vue 3 从底层重写，解决了以上所有问题。

## Composition API

Composition API 是 Vue 3 最重要的新特性，提供了一组基于函数的 API 来组织组件逻辑：

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

### ref 和 reactive

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

### 抽取可复用逻辑：Composables

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

在组件中使用：

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

## 新的响应式系统

Vue 3 使用 `Proxy` 替代了 `Object.defineProperty`：

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

## 更快的虚拟 DOM

Vue 3 编译器对模板进行静态分析，生成优化的渲染代码：

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

关键优化包括：

1. **静态提升（Static Hoisting）**：静态节点只创建一次
2. **Patch Flags**：编译器为动态节点打标记，diff 只比较标记的部分
3. **Block Tree**：将包含动态节点的片段提升为 Block
4. **缓存事件处理器**：内联事件处理器会被缓存

## Fragment、Teleport 和 Suspense

### Fragment

Vue 3 组件可以有多个根节点：

```vue
<template>
  <header>页头</header>
  <main>内容</main>
  <footer>页脚</footer>
</template>
```

### Teleport

将子组件渲染到 DOM 树的其他位置：

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

处理异步组件的加载状态：

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

## 模块化的内部结构

Vue 3 采用 monorepo，核心模块可独立使用：

```
@vue/reactivity     // 响应式系统
@vue/runtime-core   // 核心运行时
@vue/runtime-dom    // DOM 运行时
@vue/compiler-core  // 核心编译器
@vue/compiler-dom   // DOM 编译器
vue                 // 完整版本
```

响应式系统可独立使用：

```js
import { reactive, watchEffect } from '@vue/reactivity';

const state = reactive({ count: 0 });
watchEffect(() => console.log(state.count));
state.count++; // 输出: 1
```

## 小结

- Vue 3 引入 Composition API，提供基于函数的逻辑组织和复用方式
- 使用 Proxy 替代 Object.defineProperty，支持数组索引、新增属性、Map/Set
- 编译器优化（静态提升、Patch Flags、Block Tree）大幅提升渲染性能
- 新增 Fragment、Teleport、Suspense 等内置组件
- 模块化架构，响应式系统可独立使用
- 更好的 TypeScript 支持
- Options API 仍然完全支持，可以渐进式迁移
