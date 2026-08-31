---
title: "Vue 3 Composition API Refactoring in Practice"
date: 2019-11-25 10:30:46
tags:
  - Vue
readingTime: 4
description: "Vue 3's Composition API introduces a brand-new way to organize component logic. Using a real user-management page, this article shows how to refactor Vue 2 Options API code with the Composition API, and demonstrates how to extract and reuse composable functions."
wordCount: 273
---

Vue 3's Composition API introduces a brand-new way to organize component logic. Using a real user-management page, this article shows how to refactor Vue 2 Options API code with the Composition API, and demonstrates how to extract and reuse composable functions.

## Before Refactoring: Options API

Suppose we have a user-management page with search, list display, pagination, and an edit dialog:

```vue
{% raw %}
<template>
  <div class="user-management">
    <div class="toolbar">
      <input
        v-model="searchKeyword"
        placeholder="搜索用户..."
        @input="handleSearch"
      />
      <button @click="showCreateDialog = true">新建用户</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <table v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>邮箱</th>
          <th>角色</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.role }}</td>
          <td>
            <button @click="editUser(user)">编辑</button>
            <button @click="deleteUser(user.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button :disabled="page === totalPages" @click="changePage(page + 1)">下一页</button>
    </div>

    <UserDialog
      v-if="showCreateDialog || editingUser"
      :user="editingUser"
      @save="handleSave"
      @close="closeDialog"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: [],
      loading: false,
      searchKeyword: '',
      page: 1,
      pageSize: 10,
      total: 0,
      showCreateDialog: false,
      editingUser: null,
    };
  },

  computed: {
    totalPages() {
      return Math.ceil(this.total / this.pageSize);
    },
  },

  watch: {
    page() {
      this.fetchUsers();
    },
  },

  mounted() {
    this.fetchUsers();
  },

  methods: {
    async fetchUsers() {
      this.loading = true;
      try {
        const response = await fetch(
          `/api/users?page=${this.page}&size=${this.pageSize}&q=${this.searchKeyword}`
        );
        const data = await response.json();
        this.users = data.list;
        this.total = data.total;
      } catch (error) {
        console.error('获取用户列表失败:', error);
      } finally {
        this.loading = false;
      }
    },

    handleSearch() {
      // 防抖处理
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.page = 1;
        this.fetchUsers();
      }, 300);
    },

    editUser(user) {
      this.editingUser = { ...user };
    },

    async deleteUser(id) {
      if (!confirm('确定删除？')) return;
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      this.fetchUsers();
    },

    async handleSave(userData) {
      const method = this.editingUser?.id ? 'PUT' : 'POST';
      const url = this.editingUser?.id
        ? `/api/users/${this.editingUser.id}`
        : '/api/users';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      this.closeDialog();
      this.fetchUsers();
    },

    changePage(newPage) {
      this.page = newPage;
    },

    closeDialog() {
      this.showCreateDialog = false;
      this.editingUser = null;
    },
  },
};
</script>
{% endraw %}
```

The problem: related logic is scattered across `data`, `computed`, `watch`, and `methods`. As features grow, the file gets long and hard to maintain.

## After Refactoring: Composition API

### Extracting a Composable: usePagination

```js
// composables/usePagination.js
import { ref, computed, watch } from 'vue';

export function usePagination(fetchFn, { pageSize = 10 } = {}) {
  const page = ref(1);
  const total = ref(0);

  const totalPages = computed(() => Math.ceil(total.value / pageSize));

  function changePage(newPage) {
    if (newPage >= 1 && newPage <= totalPages.value) {
      page.value = newPage;
    }
  }

  watch(page, () => fetchFn());

  return { page, total, totalPages, changePage, pageSize };
}
```

### Extracting a Composable: useSearch

```js
// composables/useSearch.js
import { ref, watch } from 'vue';

export function useSearch(callback, { debounce = 300 } = {}) {
  const keyword = ref('');
  let timer = null;

  function handleSearch() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      callback(keyword.value);
    }, debounce);
  }

  // 也可以用 watch 实现
  watch(keyword, () => {
    handleSearch();
  });

  return { keyword, handleSearch };
}
```

### Extracting a Composable: useCrud

```js
// composables/useCrud.js
import { ref } from 'vue';

export function useCrud(apiBase) {
  const items = ref([]);
  const loading = ref(false);
  const editingItem = ref(null);
  const showCreateDialog = ref(false);

  async function fetchAll(params = {}) {
    loading.value = true;
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${apiBase}?${query}`);
      const data = await response.json();
      items.value = data.list;
      return data;
    } catch (error) {
      console.error('获取数据失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function create(item) {
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return response.json();
  }

  async function update(id, item) {
    const response = await fetch(`${apiBase}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return response.json();
  }

  async function remove(id) {
    await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
  }

  function edit(item) {
    editingItem.value = { ...item };
  }

  function closeDialog() {
    showCreateDialog.value = false;
    editingItem.value = null;
  }

  async function save(itemData) {
    if (editingItem.value?.id) {
      await update(editingItem.value.id, itemData);
    } else {
      await create(itemData);
    }
    closeDialog();
  }

  return {
    items,
    loading,
    editingItem,
    showCreateDialog,
    fetchAll,
    create,
    update,
    remove,
    edit,
    closeDialog,
    save,
  };
}
```

### Extracting a Composable: useConfirm

```js
// composables/useConfirm.js
export function useConfirm() {
  async function confirm(message) {
    return window.confirm(message);
  }

  async function confirmDelete(message = '确定删除？') {
    return confirm(message);
  }

  return { confirm, confirmDelete };
}
```

### The Refactored Component

```vue
{% raw %}
<template>
  <div class="user-management">
    <div class="toolbar">
      <input
        v-model="keyword"
        placeholder="搜索用户..."
      />
      <button @click="showCreateDialog = true">新建用户</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <table v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>邮箱</th>
          <th>角色</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.role }}</td>
          <td>
            <button @click="edit(user)">编辑</button>
            <button @click="handleDelete(user.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button :disabled="page === totalPages" @click="changePage(page + 1)">下一页</button>
    </div>

    <UserDialog
      v-if="showCreateDialog || editingItem"
      :user="editingItem"
      @save="handleSave"
      @close="closeDialog"
    />
  </div>
</template>

<script>
import { onMounted, watch } from 'vue';
import { usePagination } from '../composables/usePagination';
import { useSearch } from '../composables/useSearch';
import { useCrud } from '../composables/useCrud';
import { useConfirm } from '../composables/useConfirm';

export default {
  setup() {
    const {
      items: users,
      loading,
      editingItem,
      showCreateDialog,
      fetchAll: fetchUsers,
      remove,
      edit,
      closeDialog,
      save,
    } = useCrud('/api/users');

    const { confirmDelete } = useConfirm();

    async function loadData() {
      await fetchUsers({
        page: page.value,
        size: pageSize,
        q: keyword.value,
      });
      total.value = users.value.length > 0
        ? parseInt(document.querySelector('[data-total]')?.dataset.total || 0)
        : 0;
    }

    const { page, total, totalPages, changePage, pageSize } = usePagination(loadData);

    const { keyword } = useSearch(() => {
      page.value = 1;
      loadData();
    });

    onMounted(() => loadData());

    async function handleDelete(id) {
      if (await confirmDelete()) {
        await remove(id);
        loadData();
      }
    }

    async function handleSave(userData) {
      await save(userData);
      loadData();
    }

    return {
      users,
      loading,
      keyword,
      page,
      totalPages,
      changePage,
      editingItem,
      showCreateDialog,
      edit,
      closeDialog,
      handleDelete,
      handleSave,
    };
  },
};
</script>
{% endraw %}
```

## Composable Naming Conventions

By Vue 3 convention:

1. File and function names start with `use`
2. Each composable owns a single concern
3. Returned `ref` and `reactive` objects stay reactive
4. Combine multiple composables to build complex features

```
composables/
├── usePagination.js    // 分页逻辑
├── useSearch.js        // 搜索逻辑
├── useCrud.js          // CRUD 操作
├── useConfirm.js       // 确认对话框
├── useMousePosition.js // 鼠标位置
├── useDebounce.js      // 防抖
├── useThrottle.js      // 节流
└── useFetch.js         // 数据获取
```

## Comparison with React Hooks

| Feature | Vue 3 Composable | React Hook |
|---------|------------------|------------|
| Reactivity | Automatic dependency tracking | Manual dependency array required |
| Call order | No restriction | Must be called at the top level |
| Side-effect cleanup | `onUnmounted` | `useEffect` returns a cleanup function |
| Reuse mechanism | Function call | Function call |
| State isolation | Independent state per call | Independent state per call |

## Summary

- The Composition API replaces the scattered Options API style with a single `setup()` function
- Composable functions extract related logic into reusable modules
- Common composables like `usePagination`, `useSearch`, and `useCrud` can be shared across components
- The `use` prefix follows the same naming convention as React Hooks
- The Composition API doesn't replace the Options API; the two can coexist
- It suits organizing complex logic in large projects; for small projects the Options API is still perfectly adequate
