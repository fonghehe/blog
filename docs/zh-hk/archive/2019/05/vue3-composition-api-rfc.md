---
title: "Vue 3 Composition API RFC 解讀"
date: 2019-05-10 16:14:05
tags:
  - Vue
readingTime: 2
description: "Vue 團隊發佈了 Composition API RFC，社區炸了——支持的説好，反對的説像 React Hooks。我仔細讀了 RFC，説説我的理解。"
---

Vue 團隊發佈了 Composition API RFC，社區炸了——支持的説好，反對的説像 React Hooks。我仔細讀了 RFC，説説我的理解。

## 為什麼需要 Composition API

Options API 的問題在大型組件裏很明顯：

```javascript
// 一個 500 行的 Vue 2 組件
export default {
  data() {
    // 用户相關：name, age, userLoading
    // 搜索相關：query, results, searchLoading
    // 分頁相關：page, total, pageSize
  },
  methods: {
    // 用户方法、搜索方法、分頁方法混在一起
  },
  computed: {
    // 各種計算屬性混在一起
  },
  watch: {
    // 各種 watch 混在一起
  },
};
// 相關邏輯分散在不同選項裏，難以維護
```

Composition API 讓相關邏輯聚合在一起。

## Composition API 基礎

```javascript
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";

export default {
  setup(props, { emit, attrs, slots }) {
    // ref：基本類型的響應式
    const count = ref(0);
    console.log(count.value); // 讀取用 .value

    // reactive：對象的響應式
    const user = reactive({
      name: "Alice",
      loading: false,
    });

    // computed
    const doubled = computed(() => count.value * 2);

    // watch
    watch(count, (newVal, oldVal) => {
      console.log(`${oldVal} → ${newVal}`);
    });

    // 生命週期
    onMounted(() => {
      console.log("掛載了");
    });

    onUnmounted(() => {
      console.log("卸載了");
    });

    // 暴露給模板
    return { count, user, doubled };
  },
};
```

## 邏輯複用（Composables）

這是 Composition API 最重要的價值：

```javascript
// composables/useUserSearch.js
import { ref, watch } from "vue";
import { debounce } from "lodash-es";

export function useUserSearch() {
  const query = ref("");
  const results = ref([]);
  const loading = ref(false);

  const search = debounce(async (q) => {
    if (!q) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      results.value = await api.searchUsers(q);
    } finally {
      loading.value = false;
    }
  }, 300);

  watch(query, search);

  return { query, results, loading };
}

// composables/usePagination.js
export function usePagination(fetchFn) {
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const data = ref([]);

  async function load() {
    const res = await fetchFn({ page: page.value, pageSize: pageSize.value });
    data.value = res.data;
    total.value = res.total;
  }

  watch([page, pageSize], load);

  return { page, pageSize, total, data, load };
}
```

```javascript
// 組件中使用
export default {
  setup() {
    // 邏輯清晰地組織在一起
    const { query, results, loading: searchLoading } = useUserSearch();
    const { page, total, data: users, load } = usePagination(api.getUsers);

    onMounted(load);

    return { query, results, searchLoading, page, total, users };
  },
};
```

## 對比 Mixin

```javascript
// Mixin 的問題：命名衝突、來源不清
export default {
  mixins: [userMixin, searchMixin, paginationMixin],
  // this.loading 來自哪個 mixin？
  // 如果兩個 mixin 都有 loading，怎麼辦？
};

// Composables 明確來源
const { loading: userLoading } = useUser();
const { loading: searchLoading } = useSearch();
```

## 我的看法

反對聲音説"太像 React Hooks 了"，我覺得這不是問題。好的思路就該借鑑。

不同之處：

- Vue Composition API 不需要 dependency array（Proxy 追蹤）
- 沒有 "Hook 規則"（不是 Hooks 機制，只是普通函數）
- 和 Options API 可以混用（不強制遷移）

RFC 最後大概率會採納，準備學起來。

## 小結

- Composition API 讓邏輯按功能組織，解決大型組件的維護問題
- Composables 替代 Mixin，來源清晰，無命名衝突
- 和 Options API 兼容，不強制遷移
- Vue 3 正式版還要等，但可以用 `@vue/composition-api` 插件在 Vue 2 上試用
