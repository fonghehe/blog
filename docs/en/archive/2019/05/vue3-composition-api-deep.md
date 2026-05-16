---
title: "Vue 3 Composition API: A Deep Dive"
date: 2019-05-08 09:40:28
tags:
  - Vue
readingTime: 1
description: "Vue 3's Composition API has been finalized in its RFC. Although the official release is still months away, understanding it deeply in advance is very worthwhile"
---

Vue 3's Composition API has been finalized in its RFC. Although the official release is still months away, understanding it deeply in advance is very worthwhile. This is not a simple upgrade to Vue 2 — it's a fundamental change in how component logic is organized.

## Why the Composition API Was Needed

Options API works great for simple components, but has obvious pain points in complex ones:

```javascript
// Options API problem: related logic is fragmented
export default {
  data() {
    return {
      // user-related
      user: null,
      userLoading: false,
      // pagination-related
      page: 1,
      pageSize: 20,
      total: 0,
      // filter-related
      filters: {},
      filterVisible: false,
    };
  },
  created() {
    this.fetchUser();
  },
  mounted() {
    this.fetchData();
  },
  watch: {
    page() {
      this.fetchData();
    },
    filters() {
      this.fetchData();
    },
  },
  // To understand one feature's logic, you have to jump back and forth
};
```

## Core of the Composition API

```javascript
import { ref, reactive, computed, watch, onMounted } from "vue";

export default {
  setup() {
    // ---- User logic (grouped together) ----
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

    // ---- Pagination logic (grouped together) ----
    const pagination = reactive({
      page: 1,
      pageSize: 20,
      total: 0,
    });

    const tableData = ref([]);
    const tableLoading = ref(false);

    watch(
      () => pagination.page,
      () => fetchData(),
    );

    async function fetchData() {
      tableLoading.value = true;
      try {
        const res = await api.getList({ ...pagination });
        tableData.value = res.data;
        pagination.total = res.total;
      } finally {
        tableLoading.value = false;
      }
    }

    onMounted(fetchData);

    return { user, userLoading, pagination, tableData, tableLoading };
  },
};
```

## Logic Reuse with Composables

```javascript
// usePagination.js — extract pagination logic as a composable
export function usePagination(fetchFn) {
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 });
  const data = ref([]);
  const loading = ref(false);

  watch(() => pagination.page, fetchData);

  async function fetchData() {
    loading.value = true;
    try {
      const res = await fetchFn({ ...pagination });
      data.value = res.data;
      pagination.total = res.total;
    } finally {
      loading.value = false;
    }
  }

  onMounted(fetchData);
  return { pagination, data, loading };
}

// Usage in any component
export default {
  setup() {
    const { pagination, data, loading } = usePagination(api.getUsers);
    return { pagination, data, loading };
  },
};
```

The Composition API's composables solve the code reuse problems that mixins had — explicit dependencies, no naming conflicts, and excellent TypeScript support.
