---
title: "Vue 3 Composition API in Practice: setup, ref, and reactive Complete Guide"
date: 2019-05-08 09:40:28
tags:
  - Vue
readingTime: 2
description: "Vue 3's Composition API has been finalized in its RFC. Although the stable release is still months away, it's worth understanding deeply now. This isn't a simple upgrade from Vue 2—it's a fundamental change in how component logic is organized."
wordCount: 163
---

Vue 3's Composition API has been finalized in its RFC. Although the stable release is still a few months away, it's worth understanding it deeply now. This isn't a simple upgrade from Vue 2 — it's a fundamental change in how component logic is organized.

## Why the Composition API

The Options API works well for simple components, but complex components have clear pain points:

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

## The Core of the Composition API

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

## Extracting Reusable Composables

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

## Using It in Components

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

## Choosing Between ref and reactive

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

## Lifecycle Mapping

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

## Summary

- The Composition API colocates related logic, solving the scattered-logic problem of the Options API.
- `setup()` is the entry point; `ref`/`reactive` manage state, while `watch`/`onMounted` handle side effects.
- Logic reuse moves from mixins to composables (functions) — clearer, with no naming collisions.
- Choose between `ref` and `reactive` based on the scenario; using `ref` consistently is recommended to reduce cognitive load.
- The Options API is still supported in Vue 3, and it's perfectly fine to use it for simple components.
