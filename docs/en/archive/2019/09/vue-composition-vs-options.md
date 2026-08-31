---
title: "Vue Composition API vs Options API Comparison"
date: 2019-09-04 15:43:47
tags:
  - Vue
readingTime: 4
description: "The Composition API introduced in Vue 3 is another important application of the functional-programming paradigm in frontend frameworks, following React Hooks. It lets developers organize component logic by function, solving the problem of scattered logic in the Options API for complex components. This article compares the two API styles across multiple dimensions and offers migration advice."
wordCount: 374
---

The Composition API introduced in Vue 3 is another important application of the functional-programming paradigm in frontend frameworks, following React Hooks. It lets developers organize component logic by function, solving the problem of scattered logic in the Options API for complex components. This article compares the two API styles across multiple dimensions and offers migration advice.

## Problems with Options API

In the Options API, the logic for one feature is scattered across multiple options such as `data`, `computed`, `methods`, and `watch`:

```vue
<script>
export default {
  data() {
    return {
      // 用户搜索相关
      searchQuery: '',
      searchResults: [],
      isSearching: false,

      // 分页相关
      currentPage: 1,
      pageSize: 10,
      total: 0,

      // 选中项
      selectedItems: [],
    };
  },

  computed: {
    // 搜索相关
    hasResults() {
      return this.searchResults.length > 0;
    },

    // 分页相关
    totalPages() {
      return Math.ceil(this.total / this.pageSize);
    },
    pageInfo() {
      return `第 ${this.currentPage} / ${this.totalPages} 页`;
    },

    // 选中项相关
    selectedCount() {
      return this.selectedItems.length;
    },
  },

  methods: {
    // 搜索相关
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

    // 分页相关
    goToPage(page) {
      this.currentPage = page;
      this.handleSearch();
    },

    // 选中项相关
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

The problem is obvious: a search feature's logic is spread across multiple options, and you have to jump around to understand the full picture. The bigger the component, the worse this gets.

## Refactoring to Composition API

With the Composition API, we can group the logic for one feature together:

```vue
<script>
import { ref, computed, watch } from 'vue';

// 搜索逻辑封装为 composable
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

// 分页逻辑封装为 composable
function usePagination() {
  const currentPage = ref(1);
  const pageSize = ref(10);

  const totalPages = computed(() =>
    Math.ceil(usePagination.total?.value / pageSize.value)
  );

  const pageInfo = computed(() =>
    `第 ${currentPage.value} / ${totalPages.value} 页`
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

// 选中逻辑封装为 composable
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

    // 组合逻辑
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

The logic for each feature lives in a single function—clear and reusable.

## Reusable Logic Comparison

### Options API Reuse: Mixins

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
  // 问题：
  // 1. 命名冲突
  // 2. 数据来源不清晰
  // 3. mixin 之间不能传递参数
};
```

### Composition API Reuse: Composables

```js
// composables/useSearch.js
import { ref } from 'vue';

export function useSearch(apiEndpoint) {
  // 可以接受参数
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
    // 每次调用创建独立实例，互不干扰
    const userSearch = useSearch('/api/users');
    const postSearch = useSearch('/api/posts');
    const pagination = usePagination();

    // 命名完全由开发者控制，不会冲突
    return {
      userQuery: userSearch.query,
      userResults: userSearch.results,
      postQuery: postSearch.query,
      postResults: postSearch.results,
    };
  },
};
```

## Type Inference Comparison

TypeScript support is another advantage of the Composition API:

```ts
// Options API 的类型推导较弱
export default Vue.extend({
  data() {
    return {
      count: 0, // 推导为 any（在 Vue 2 中）
    };
  },
  methods: {
    increment() {
      this.count; // 类型推导不完整
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

// 使用时获得完整的类型提示
const { count, doubled, increment } = useCounter();
// count.value: number
// doubled.value: number
// increment: () => void
```

## When to Use Options API vs Composition API

### When Options API Fits

1. **Simple presentational components** — logic is simple and doesn't need reuse.
2. **Team experienced with Vue** — the Options API is easier to understand and constrains structure.
3. **No TypeScript needed** — the Options API is perfectly adequate in JS projects.

### When Composition API Fits

1. **Complex components** — logic crosses concerns and needs to be organized by feature.
2. **Logic reuse** — logic needs to be shared across multiple components.
3. **TypeScript projects** — it gives better type inference.
4. **Functional preference** — the team is more comfortable with a functional style.

### The Two APIs Can Coexist

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

    // 可以访问 props
    const page = ref(props.initialPage);

    return { query, results, search, page };
  },

  // 仍然可以使用 Options API 的其他选项
  created() {
    console.log('created hook');
  },

  methods: {
    // 可以在 methods 中调用 setup 暴露的值
    // 通过 this 访问
  },
};
</script>
```

## Summary

- The Composition API organizes logic via the `setup()` function and composable functions, solving the scattered-logic problem of the Options API.
- Composable functions (similar to React Hooks) offer better logic reuse than mixins.
- The Composition API supports TypeScript natively, with complete type inference.
- The two APIs can coexist in the same project; migration isn't forced.
- Use the Options API for simple components, and the Composition API for complex or reusable ones.
- Vue 3's Composition API drew inspiration from React Hooks but is based on the reactivity system rather than closures, avoiding some hooks pitfalls (such as stale closures).
