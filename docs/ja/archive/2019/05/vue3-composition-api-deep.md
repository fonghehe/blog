---
title: "Vue 3 Composition API 深度解析"
date: 2019-05-08 09:40:28
tags:
  - Vue
readingTime: 2
description: "Vue 3のComposition APIはRFCで確定しました。正式リリースはまだ数ヶ月先ですが、事前に深く理解することは非常に価値があります。これはVue 2の単純なアップグレードではなく、コンポーネントロジックの組織化方法の根本的な変化です。"
---

Vue 3のComposition APIはRFCで確定しました。正式リリースはまだ数ヶ月先ですが、事前に深く理解することは非常に価値があります。これはVue 2の単純なアップグレードではなく、コンポーネントロジックの組織化方法の根本的な変化です。

## なぜComposition APIが必要か

Options APIはシンプルなコンポーネントには優れていますが、複雑なコンポーネントでは明らかな問題があります：

```javascript
// Options APIの問題：関連ロジックが分散している
export default {
  data() {
    return {
      // ユーザー関連
      user: null,
      userLoading: false,
      // ページネーション関連
      page: 1,
      pageSize: 20,
      total: 0,
      // フィルター関連
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
  // 一つの機能のロジックを理解するために上下に何度もジャンプする必要がある
};
```

## Composition APIのコア

```javascript
import { ref, reactive, computed, watch, onMounted } from "vue";

export default {
  setup() {
    // ---- ユーザーロジック（まとめて） ----
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

    // ---- ページネーションロジック（まとめて） ----
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

## Composablesによるロジックの再利用

```javascript
// usePagination.js — ページネーションロジックをComposableとして抽出
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

// 任意のコンポーネントで使用
export default {
  setup() {
    const { pagination, data, loading } = usePagination(api.getUsers);
    return { pagination, data, loading };
  },
};
```

Composition APIのComposablesはMixinが抱えていたコード再利用の問題を解決します——明示的な依存関係、命名の競合なし、優れたTypeScriptサポート。
