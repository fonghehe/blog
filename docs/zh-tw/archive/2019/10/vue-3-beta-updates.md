---
title: "Vue 3 Beta 更新內容跟蹤"
date: 2019-10-10 16:50:19
tags:
  - Vue
readingTime: 4
description: "Vue 3 自 2018 年 VueConf 上宣佈重寫以來，一直在穩步推進。截至目前，Vue 3 已經進入 Beta 階段，核心 API 趨於穩定。本文整理 Vue 3 的主要變化，幫助 Vue 2 開發者提前瞭解即將到來的變化。"
wordCount: 584
---

Vue 3 自 2018 年 VueConf 上宣佈重寫以來，一直在穩步推進。截至目前，Vue 3 已經進入 Beta 階段，核心 API 趨於穩定。本文整理 Vue 3 的主要變化，幫助 Vue 2 開發者提前瞭解即將到來的變化。

## 為什麼要重寫

Vue 2 的程式碼庫經過幾年發展，暴露了一些架構上的限制：

1. **程式碼組織**：Options API 使得相關邏輯分散在不同選項中，大型元件難以維護
2. **型別推導**：Options API 的物件寫法對 TypeScript 支援有限
3. **效能瓶頸**：虛擬 DOM 的 diff 演算法是全量比較，無法跳過靜態內容
4. **體積**：不支援 Tree Shaking，打包整個執行時

Vue 3 從底層重寫，解決了以上所有問題。

## Composition API

Composition API 是 Vue 3 最重要的新特性，提供了一組基於函式的 API 來組織元件邏輯：

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

// ref: 包裝基本型別
const count = ref(0);
console.log(count.value); // 0
count.value++;

// reactive: 建立響應式物件
const state = reactive({
  name: '張三',
  age: 25
});

// 模板中不需要 .value
```

### 抽取可複用邏輯：Composables

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

在元件中使用：

```vue
{% raw %}
<template>
  <div>
    <p>滑鼠位置: {{ x }}, {{ y }}</p>
    <input v-model="keyword" placeholder="搜尋..." />
    <div v-if="loading">載入中...</div>
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

## 新的響應式系統

Vue 3 使用 `Proxy` 替代了 `Object.defineProperty`：

```js
import { reactive, watch, watchEffect } from 'vue';

// 1. 可以監聽新增屬性
const state = reactive({ count: 0 });
state.name = '新屬性'; // 自動變為響應式

// 2. 可以監聽陣列索引
const list = reactive([1, 2, 3]);
list[0] = 100; // 自動變為響應式

// 3. 可以監聽 Map、Set 等
const map = reactive(new Map());
map.set('key', 'value');

// watchEffect: 自動追蹤依賴
watchEffect(() => {
  console.log(`count is: ${state.count}`);
});
```

## 更快的虛擬 DOM

Vue 3 編譯器對模板進行靜態分析，生成最佳化的渲染程式碼：

```js
// 靜態節點被提升到渲染函式外部
const _hoisted_1 = /*#__PURE__*/ createVNode("h1", null, "標題", -1);

function render(_ctx, _cache) {
  return (_openBlock(), _createBlock("div", null, [
    _hoisted_1,  // 靜態節點直接複用
    _createVNode("p", null, _toDisplayString(_ctx.text), 1 /* TEXT */)
  ]));
}
```

關鍵最佳化包括：

1. **靜態提升（Static Hoisting）**：靜態節點只建立一次
2. **Patch Flags**：編譯器為動態節點打標記，diff 只比較標記的部分
3. **Block Tree**：將包含動態節點的片段提升為 Block
4. **快取事件處理器**：內聯事件處理器會被快取

## Fragment、Teleport 和 Suspense

### Fragment

Vue 3 元件可以有多個根節點：

```vue
<template>
  <header>頁頭</header>
  <main>內容</main>
  <footer>頁尾</footer>
</template>
```

### Teleport

將子元件渲染到 DOM 樹的其他位置：

```vue
<template>
  <button @click="showModal = true">開啟彈窗</button>
  <Teleport to="body">
    <Modal v-if="showModal" @close="showModal = false">
      <h2>彈窗標題</h2>
    </Modal>
  </Teleport>
</template>
```

### Suspense

處理非同步元件的載入狀態：

```vue
<template>
  <Suspense>
    <template #default>
      <AsyncUserProfile :userId="userId" />
    </template>
    <template #fallback>
      <div>載入中...</div>
    </template>
  </Suspense>
</template>
```

## 模組化的內部結構

Vue 3 採用 monorepo，核心模組可獨立使用：

```
@vue/reactivity     // 響應式系統
@vue/runtime-core   // 核心執行時
@vue/runtime-dom    // DOM 執行時
@vue/compiler-core  // 核心編譯器
@vue/compiler-dom   // DOM 編譯器
vue                 // 完整版本
```

響應式系統可獨立使用：

```js
import { reactive, watchEffect } from '@vue/reactivity';

const state = reactive({ count: 0 });
watchEffect(() => console.log(state.count));
state.count++; // 輸出: 1
```

## 小結

- Vue 3 引入 Composition API，提供基於函式的邏輯組織和複用方式
- 使用 Proxy 替代 Object.defineProperty，支援陣列索引、新增屬性、Map/Set
- 編譯器最佳化（靜態提升、Patch Flags、Block Tree）大幅提升渲染效能
- 新增 Fragment、Teleport、Suspense 等內建元件
- 模組化架構，響應式系統可獨立使用
- 更好的 TypeScript 支援
- Options API 仍然完全支援，可以漸進式遷移
