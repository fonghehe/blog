---
title: "Vue 3 Composition API 実践：setup、ref 与 reactive 完全ガイド"
date: 2019-05-08 09:40:28
tags:
  - Vue
readingTime: 3
description: "Vue 3 的 Composition API 已经在 RFC 中敲定，虽然正式版还要几个月，但提前深入理解很有必要。这不是 Vue 2 的简单升级，而是组件逻辑组织方式的根本变化。"
wordCount: 410
---

Vue 3 の Composition API は RFC で確定済みだ。正式版のリリースはあと数カ月だが、事前に深く理解しておく価値は大きい。これは Vue 2 の単なるアップグレードではなく、コンポーネントのロジックをどう構成するかという根本的な変化だ。

## なぜ Composition API が必要なのか

Options API はシンプルなコンポーネントでは扱いやすいが、複雑なコンポーネントになると明確な悩みの種（ペインポイント）が出てくる：

```javascript
// Options API 的问题：相关逻辑被拆散
export default {
  data() {
    return {
      // 用户相关
      user: null,
      userLoading: false,
      // 分页相关
      page: 1,
      pageSize: 20,
      total: 0,
      // 筛选相关
      filters: {},
      filterVisible: false,
    };
  },
  // 用户相关的逻辑
  created() { this.fetchUser(); },
  // 数据相关的逻辑
  mounted() { this.fetchData(); },
  watch: {
    page() { this.fetchData(); },
    filters() { this.fetchData(); },
  },
  // 想要理清一个功能的逻辑，需要上下反复跳转
};
```

## Composition API の核心

```javascript
import { ref, reactive, computed, watch, onMounted } from 'vue';

export default {
  setup() {
    // ---- 用户逻辑（集中在一起）----
    const user = ref(null);
    const userLoading = ref(false);

    async function fetchUser() {
      userLoading.value = true;
      try {
        user.value = await api.getCurrentUser();
      } finally {
        userLoading.value = false;
      }
    }

    onMounted(fetchUser);

    // ---- 分页逻辑（集中在一起）----
    const pagination = reactive({
      page: 1,
      pageSize: 20,
      total: 0,
    });

    const tableData = ref([]);
    const tableLoading = ref(false);

    watch(
      () => pagination.page,
      () => fetchData()
    );

    async function fetchData() {
      tableLoading.value = true;
      try {
        const res = await api.getList({
          page: pagination.page,
          pageSize: pagination.pageSize,
        });
        tableData.value = res.list;
        pagination.total = res.total;
      } finally {
        tableLoading.value = false;
      }
    }

    onMounted(fetchData);

    return {
      user, userLoading,
      pagination, tableData, tableLoading,
    };
  },
};
```

## 再利用可能な Composables への抽出

```javascript
// composables/usePagination.js
import { ref, reactive, watch } from 'vue';

export function usePagination(requestFn, options = {}) {
  const { immediate = true, defaultPageSize = 20 } = options;

  const loading = ref(false);
  const data = ref([]);
  const pagination = reactive({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  });

  async function fetchData() {
    loading.value = true;
    try {
      const res = await requestFn({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      data.value = res.list;
      pagination.total = res.total;
    } finally {
      loading.value = false;
    }
  }

  function changePage(page) {
    pagination.page = page;
  }

  watch(() => pagination.page, fetchData);

  if (immediate) {
    fetchData();
  }

  return {
    loading,
    data,
    pagination,
    fetchData,
    changePage,
  };
}

// composables/useUser.js
import { ref, onMounted } from 'vue';

export function useUser() {
  const user = ref(null);
  const loading = ref(false);

  async function fetchUser() {
    loading.value = true;
    try {
      user.value = await api.getCurrentUser();
    } finally {
      loading.value = false;
    }
  }

  onMounted(fetchUser);

  return { user, loading, fetchUser };
}
```

## コンポーネントでの使用

```vue
<script>
import { useUser } from '@/composables/useUser';
import { usePagination } from '@/composables/usePagination';

export default {
  setup() {
    const { user, loading: userLoading } = useUser();
    const {
      data: tableData,
      loading: tableLoading,
      pagination,
      changePage,
    } = usePagination((params) => api.getOrders(params));

    return {
      user, userLoading,
      tableData, tableLoading,
      pagination, changePage,
    };
  },
};
</script>
```

## ref と reactive の使い分け

```javascript
// ref：适合原始值和需要替换整个值的场景
const count = ref(0);
count.value++; // 访问需要 .value

const name = ref('hello');
name.value = 'world'; // 替换整个值

// reactive：适合对象和需要保持引用的场景
const state = reactive({
  user: null,
  list: [],
});

// 直接访问属性，不需要 .value
state.user = { name: 'test' };
state.list.push({ id: 1 });

// 实践建议：统一用 ref，减少心智负担
const state = ref({
  user: null,
  list: [],
});
state.value.user = { name: 'test' }; // 访问 .value 后就是普通对象
```

## ライフサイクルの対応関係

```javascript
// Options API  →  Composition API
// beforeCreate → 不需要（setup 本身就是）
// created      → 不需要（setup 本身就是）
// beforeMount  → onBeforeMount
// mounted      → onMounted
// beforeUpdate → onBeforeUpdate
// updated      → onUpdated
// beforeDestroy→ onBeforeUnmount
// destroyed    → onUnmounted
// errorCaptured→ onErrorCaptured
```

## まとめ

- Composition API は関連するロジックを一箇所にまとめ、Options API が抱えていたロジックの分散という問題を解決する
- `setup()` がエントリーポイントとなり、`ref`/`reactive` が状態を管理し、`watch`/`onMounted` が副作用を処理する
- ロジックの再利用は mixins から composables（関数）へと変わり、より明確で命名衝突も起きない
- `ref` と `reactive` の選択は場面によるが、統一して `ref` を使う方が認知負荷を下げられる（おすすめ）
- Options API は Vue 3 でも引き続きサポートされている。シンプルなコンポーネントなら Options API を使っても問題ない
