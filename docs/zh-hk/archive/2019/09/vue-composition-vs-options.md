---
title: "Vue Composition API vs Options API 對比：落地路徑與實戰建議"
date: 2019-09-04 15:43:47
tags:
  - Vue
readingTime: 4
description: "Vue 3 引入的 Composition API 是繼 React Hooks 之後又一個重要的函數式編程範式在前端框架中的實踐。它允許開發者以函數為單位組織組件邏輯，解決了 Options API 在複雜組件中邏輯分散的問題。本文將從多個維度對比兩種 API 風格，並給出遷移建議。"
wordCount: 554
---

Vue 3 引入的 Composition API 是繼 React Hooks 之後又一個重要的函數式編程範式在前端框架中的實踐。它允許開發者以函數為單位組織組件邏輯，解決了 Options API 在複雜組件中邏輯分散的問題。本文將從多個維度對比兩種 API 風格，並給出遷移建議。

## Options API 的問題

在 Options API 中，一個功能的邏輯分散在 data、computed、methods、watch 等多個選項中：

```vue
<script>
export default {
  data() {
    return {
      // 用户搜索相關
      searchQuery: '',
      searchResults: [],
      isSearching: false,

      // 分頁相關
      currentPage: 1,
      pageSize: 10,
      total: 0,

      // 選中項
      selectedItems: [],
    };
  },

  computed: {
    // 搜索相關
    hasResults() {
      return this.searchResults.length > 0;
    },

    // 分頁相關
    totalPages() {
      return Math.ceil(this.total / this.pageSize);
    },
    pageInfo() {
      return `第 ${this.currentPage} / ${this.totalPages} 頁`;
    },

    // 選中項相關
    selectedCount() {
      return this.selectedItems.length;
    },
  },

  methods: {
    // 搜索相關
    async handleSearch() {
      this.isSearching = true;
      try {
        const result = await api.search(this.searchQuery, {
          page: this.currentPage,
          pageSize: this.pageSize,
        });
        this.searchResults = result.items;
        this.total = result.total;
      } finally {
        this.isSearching = false;
      }
    },

    // 分頁相關
    goToPage(page) {
      this.currentPage = page;
      this.handleSearch();
    },

    // 選中項相關
    toggleSelect(item) {
      const index = this.selectedItems.findIndex(i => i.id === item.id);
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push(item);
      }
    },
  },

  watch: {
    searchQuery() {
      this.currentPage = 1;
      this.handleSearch();
    },
  },
};
</script>
```

問題很明顯：搜尋功能的邏輯分散在多個選項中，需要來回跳轉才能理解完整邏輯。組件越大，這個問題越嚴重。

## Composition API 重構

使用 Composition API，我們可以將同一功能的邏輯組織在一起：

```vue
<script>
import { ref, computed, watch } from 'vue';

// 搜索邏輯封裝為 composable
function useSearch() {
  const searchQuery = ref('');
  const searchResults = ref([]);
  const isSearching = ref(false);
  const total = ref(0);

  const hasResults = computed(() => searchResults.value.length > 0);

  async function search(page = 1, pageSize = 10) {
    isSearching.value = true;
    try {
      const result = await api.search(searchQuery.value, { page, pageSize });
      searchResults.value = result.items;
      total.value = result.total;
    } finally {
      isSearching.value = false;
    }
  }

  return {
    searchQuery,
    searchResults,
    isSearching,
    total,
    hasResults,
    search,
  };
}

// 分頁邏輯封裝為 composable
function usePagination() {
  const currentPage = ref(1);
  const pageSize = ref(10);

  const totalPages = computed(() =>
    Math.ceil(usePagination.total?.value / pageSize.value)
  );

  const pageInfo = computed(() =>
    `第 ${currentPage.value} / ${totalPages.value} 頁`
  );

  function goToPage(page) {
    currentPage.value = page;
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    pageInfo,
    goToPage,
  };
}

// 選中邏輯封裝為 composable
function useSelection() {
  const selectedItems = ref([]);

  const selectedCount = computed(() => selectedItems.value.length);

  function toggleSelect(item) {
    const index = selectedItems.value.findIndex(i => i.id === item.id);
    if (index > -1) {
      selectedItems.value.splice(index, 1);
    } else {
      selectedItems.value.push(item);
    }
  }

  function clearSelection() {
    selectedItems.value = [];
  }

  return {
    selectedItems,
    selectedCount,
    toggleSelect,
    clearSelection,
  };
}

export default {
  setup() {
    const {
      searchQuery,
      searchResults,
      isSearching,
      total,
      hasResults,
      search,
    } = useSearch();

    const {
      currentPage,
      pageSize,
      pageInfo,
      goToPage,
    } = usePagination();

    const {
      selectedItems,
      selectedCount,
      toggleSelect,
    } = useSelection();

    // 組合邏輯
    watch(searchQuery, () => {
      currentPage.value = 1;
      search(currentPage.value, pageSize.value);
    });

    function onPageChange(page) {
      goToPage(page);
      search(page, pageSize.value);
    }

    return {
      searchQuery,
      searchResults,
      isSearching,
      hasResults,
      pageInfo,
      selectedItems,
      selectedCount,
      toggleSelect,
      onPageChange,
    };
  },
};
</script>
```

每個功能的邏輯都集中在一個函數中，清晰且可複用。

## 複用邏輯對比

### Options API 複用：Mixins

```js
// mixins/searchMixin.js
export default {
  data() {
    return {
      searchQuery: '',
      searchResults: [],
    };
  },
  methods: {
    async search() { /* ... */ },
  },
};

// 使用
export default {
  mixins: [searchMixin, paginationMixin],
  // 問題：
  // 1. 命名衝突
  // 2. 數據來源不清晰
  // 3. mixin 之間不能傳遞參數
};
```

### Composition API 複用：Composables

```js
// composables/useSearch.js
import { ref } from 'vue';

export function useSearch(apiEndpoint) {
  // 可以接受參數
  const query = ref('');
  const results = ref([]);

  async function search() {
    const response = await fetch(`${apiEndpoint}?q=${query.value}`);
    results.value = await response.json();
  }

  return { query, results, search };
}

// 使用
import { useSearch } from './composables/useSearch';
import { usePagination } from './composables/usePagination';

export default {
  setup() {
    // 每次調用創建獨立實例，互不幹擾
    const userSearch = useSearch('/api/users');
    const postSearch = useSearch('/api/posts');
    const pagination = usePagination();

    // 命名完全由開發者控製，不會衝突
    return {
      userQuery: userSearch.query,
      userResults: userSearch.results,
      postQuery: postSearch.query,
      postResults: postSearch.results,
    };
  },
};
```

## 類型推導對比

TypeScript 支持是 Composition API 的另一個優勢：

```ts
// Options API 的類型推導較弱
export default Vue.extend({
  data() {
    return {
      count: 0, // 推導為 any（在 Vue 2 中）
    };
  },
  methods: {
    increment() {
      this.count; // 類型推導不完整
    },
  },
});

// Composition API 天然支持 TypeScript
import { ref, computed, Ref } from 'vue';

function useCounter(initialValue: number = 0) {
  const count: Ref<number> = ref(initialValue);

  const doubled = computed((): number => count.value * 2);

  function increment(): void {
    count.value++;
  }

  function setCount(value: number): void {
    count.value = value;
  }

  return {
    count,
    doubled,
    increment,
    setCount,
  };
}

// 使用時獲得完整的類型提示
const { count, doubled, increment } = useCounter();
// count.value: number
// doubled.value: number
// increment: () => void
```

## 何時用 Options API，何時用 Composition API

### 適合 Options API 的場景

1. **簡單的展示型組件** — 邏輯簡單，不需要複用
2. **團隊 Vue 經驗豐富** — Options API 更容易理解和約束
3. **不需要 TypeScript** — Options API 在 JS 項目中完全夠用

### 適合 Composition API 的場景

1. **複雜組件** — 邏輯交叉，需要按功能組織
2. **邏輯複用** — 需要在多個組件間共享邏輯
3. **TypeScript 項目** — 獲得更好的類型推導
4. **函數式偏好** — 團隊更習慣函數式風格

### 兩種 API 可以共存

```vue
<script>
import { ref, computed, setup } from 'vue';
import { useSearch } from './composables/useSearch';

export default {
  // Options API 部分
  props: {
    initialPage: { type: Number, default: 1 },
  },

  // Composition API 部分
  setup(props) {
    const { query, results, search } = useSearch();

    // 可以訪問 props
    const page = ref(props.initialPage);

    return { query, results, search, page };
  },

  // 仍然可以使用 Options API 的其他選項
  created() {
    console.log('created hook');
  },

  methods: {
    // 可以在 methods 中調用 setup 暴露的值
    // 通過 this 訪問
  },
};
</script>
```

## 小結

- Composition API 通過 `setup()` 函數和組合式函數組織邏輯，解決了 Options API 中邏輯分散的問題
- Composable 函數（類似 React Hooks）提供了比 Mixins 更好的邏輯複用方式
- Composition API 天然支持 TypeScript，類型推導完整
- 兩種 API 可以在同一項目中共存，不需要強製遷移
- 簡單組件使用 Options API，複雜/需要複用的組件使用 Composition API
- Vue 3 的 Composition API 設計借鑑了 React Hooks，但基於響應式系統而非閉包，避免了 hooks 的一些陷阱（如 stale closure）
