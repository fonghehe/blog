---
title: "Vue Composition API vs Options API Comparison"
date: 2019-09-04 15:43:47
tags:
  - Vue
readingTime: 4
description: "Vue 3 引入的 Composition API 是继 React Hooks 之后又一个重要的函数式编程范式在前端框架中的实践。它允许开发者以函数为单位组织组件逻辑，解决了 Options API 在复杂组件中逻辑分散的问题。本文将从多个维度对比两种 API 风格，并给出迁移建议。"
---

Vue 3 引入的 Composition API 是继 React Hooks 之后又一个重要的函数式编程范式在前端框架中的实践。它允许开发者以函数为单位组织组件逻辑，解决了 Options API 在复杂组件中逻辑分散的问题。本文将从多个维度对比两种 API 风格，并给出迁移建议。

## Problems with Options API

在 Options API 中，一个功能的逻辑分散在 data、computed、methods、watch 等多个选项中：

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

问题很明显：搜索功能的逻辑分散在多个选项中，需要来回跳转才能理解完整逻辑。组件越大，这个问题越严重。

## Refactoring to Composition API

使用 Composition API，我们可以将同一功能的逻辑组织在一起：

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

每个功能的逻辑都集中在一个函数中，清晰且可复用。

## Reusable Logic Comparison

### Options API 复用：Mixins

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

### Composition API 复用：Composables

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

TypeScript 支持是 Composition API 的另一个优势：

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

### 适合 Options API 的场景

1. **简单的展示型组件** — 逻辑简单，不需要复用
2. **团队 Vue 经验丰富** — Options API 更容易理解和约束
3. **不需要 TypeScript** — Options API 在 JS 项目中完全够用

### 适合 Composition API 的场景

1. **复杂组件** — 逻辑交叉，需要按功能组织
2. **逻辑复用** — 需要在多个组件间共享逻辑
3. **TypeScript 项目** — 获得更好的类型推导
4. **函数式偏好** — 团队更习惯函数式风格

### 两种 API 可以共存

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

- Composition API 通过 `setup()` 函数和组合式函数组织逻辑，解决了 Options API 中逻辑分散的问题
- Composable 函数（类似 React Hooks）提供了比 Mixins 更好的逻辑复用方式
- Composition API 天然支持 TypeScript，类型推导完整
- 两种 API 可以在同一项目中共存，不需要强制迁移
- 简单组件使用 Options API，复杂/需要复用的组件使用 Composition API
- Vue 3 的 Composition API 设计借鉴了 React Hooks，但基于响应式系统而非闭包，避免了 hooks 的一些陷阱（如 stale closure）
