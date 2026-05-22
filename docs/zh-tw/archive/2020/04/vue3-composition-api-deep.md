---
title: "Vue 3 Composition API 實戰：setup、ref 與 reactive 完整指南"
date: 2019-05-08 09:40:28
tags:
  - Vue
readingTime: 2
description: "Vue 3 的 Composition API 已經在 RFC 中敲定，雖然正式版還要幾個月，但提前深入理解很有必要。這不是 Vue 2 的簡單升級，而是元件邏輯組織方式的根本變化。"
wordCount: 225
---

Vue 3 的 Composition API 已經在 RFC 中敲定，雖然正式版還要幾個月，但提前深入理解很有必要。這不是 Vue 2 的簡單升級，而是元件邏輯組織方式的根本變化。

## 為什麼需要 Composition API

Options API 在簡單元件中很好用，但複雜元件有明顯痛點：

```javascript
// Options API 的問題：相關邏輯被拆散
export default {
  data() {
    return {
      // 使用者相關
      user: null,
      userLoading: false,
      // 分頁相關
      page: 1,
      pageSize: 20,
      total: 0,
      // 篩選相關
      filters: {},
      filterVisible: false,
    };
  },
  // 使用者相關的邏輯
  created() { this.fetchUser(); },
  // 資料相關的邏輯
  mounted() { this.fetchData(); },
  watch: {
    page() { this.fetchData(); },
    filters() { this.fetchData(); },
  },
  // 想要理清一個功能的邏輯，需要上下反覆跳轉
};
```

## Composition API 的核心

```javascript
import { ref, reactive, computed, watch, onMounted } from 'vue';

export default {
  setup() {
    // 
---- 使用者邏輯（集中在一起）----
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

    // ---- 分頁邏輯（集中在一起）----
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

## 抽取為可複用的 Composables

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

## 在元件中使用

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

## ref vs reactive 怎麼選

```javascript
// ref：適合原始值和需要替換整個值的場景
const count = ref(0);
count.value++; // 訪問需要 .value

const name = ref('hello');
name.value = 'world'; // 替換整個值

// reactive：適合物件和需要保持引用的場景
const state = reactive({
  user: null,
  list: [],
});

// 直接訪問屬性，不需要 .value
state.user = { name: 'test' };
state.list.push({ id: 1 });

// 實踐建議：統一用 ref，減少心智負擔
const state = ref({
  user: null,
  list: [],
});
state.value.user = { name: 'test' }; // 訪問 .value 後就是普通物件
```

## 生命週期對應關係

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

## 小結

- Composition API 把相關邏輯集中到一起，解決 Options API 邏輯分散的問題
- `setup()` 是入口，`ref`/`reactive` 管理狀態，`watch`/`onMounted` 處理副作用
- 邏輯複用從 mixins 變成 composables（函式），更清晰、無命名衝突
- `ref` 和 `reactive` 選擇看場景，建議統一用 `ref` 降低心智負擔
- Options API 在 Vue 3 中仍然支援，簡單元件用 Options API 也沒問題
