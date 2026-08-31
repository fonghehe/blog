---
title: "Vue 3 Beta更新内容トラッキング"
date: 2019-10-10 16:50:19
tags:
  - Vue
readingTime: 5
description: "Vue 3 自 2018 年 VueConf 上宣布重写以来，一直在稳步推进。截至目前，Vue 3 已经进入 Beta 阶段，核心 API 趋于稳定。本文整理 Vue 3 的主要变化，帮助 Vue 2 开发者提前了解即将到来的变化。"
wordCount: 1004
---

Vue 3 は 2018 年の VueConf で書き直しが発表されて以来、着実に進められてきました。現時点で Vue 3 は Beta 段階に入り、コア API は安定しています。本記事では Vue 3 の主な変更を整理し、Vue 2 の開発者がこれからの変化を事前に知る手助けをします。

## なぜ書き直すのか

Vue 2 のコードベースは数年の発展を経て、いくつかのアーキテクチャ上の制限が明らかになりました：

1. **コードの整理**：Options API では関連するロジックが異なるオプションに分散し、大規模なコンポーネントは保守しにくくなります
2. **型推論**：Options API のオブジェクト記法は TypeScript のサポートが限定的です
3. **パフォーマンスのボトルネック**：仮想 DOM の diff アルゴリズムは全量比較であり、静的コンテンツをスキップできません
4. **バンドルサイズ**：Tree Shaking に対応しておらず、ランタイム全体をバンドルします

Vue 3 は下層から書き直され、上記のすべての問題を解決しました。

## Composition API

Composition API は Vue 3 で最も重要な新機能であり、関数ベースの API のセットでコンポーネントのロジックを整理できます：

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

### ref と reactive

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

### 再利用可能なロジックの抽出：Composables

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

コンポーネントでの使用：

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

## 新しいリアクティブシステム

Vue 3 は `Object.defineProperty` の代わりに `Proxy` を使います：

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

## より高速な仮想DOM

Vue 3 のコンパイラはテンプレートを静的解析し、最適化されたレンダリングコードを生成します：

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

主な最適化は以下のとおりです：

1. **静的ホイスティング（Static Hoisting）**：静的ノードは一度だけ作成されます
2. **Patch Flags**：コンパイラが動的ノードにマークを付け、diff はマークされた部分だけを比較します
3. **Block Tree**：動的ノードを含むフラグメントを Block に引き上げます
4. **イベントハンドラのキャッシュ**：インラインのイベントハンドラはキャッシュされます

## Fragment、Teleport、Suspense

### Fragment

Vue 3 のコンポーネントは複数のルートノードを持てます：

```vue
<template>
  <header>页头</header>
  <main>内容</main>
  <footer>页脚</footer>
</template>
```

### Teleport

子コンポーネントを DOM ツリーの別の位置に描画します：

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

非同期コンポーネントのロード状態を扱います：

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

## モジュール化された内部アーキテクチャ

Vue 3 は monorepo を採用しており、コアモジュールは独立して利用できます：

```
@vue/reactivity     // 响应式系统
@vue/runtime-core   // 核心运行时
@vue/runtime-dom    // DOM 运行时
@vue/compiler-core  // 核心编译器
@vue/compiler-dom   // DOM 编译器
vue                 // 完整版本
```

リアクティブシステムは独立して利用できます：

```js
import { reactive, watchEffect } from '@vue/reactivity';

const state = reactive({ count: 0 });
watchEffect(() => console.log(state.count));
state.count++; // 输出: 1
```

## まとめ

- Vue 3 は Composition API を導入し、関数ベースのロジックの整理と再利用を提供します
- `Object.defineProperty` の代わりに Proxy を使い、配列インデックス・新規プロパティ・Map/Set に対応
- コンパイラの最適化（静的ホイスティング、Patch Flags、Block Tree）がレンダリング性能を大きく向上
- Fragment、Teleport、Suspense などの組み込みコンポーネントが追加
- モジュール化されたアーキテクチャにより、リアクティブシステムを独立して利用可能
- より良い TypeScript サポート
- Options API は引き続き完全にサポートされ、段階的に移行可能
