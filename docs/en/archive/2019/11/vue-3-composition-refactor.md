---
title: "Vue 3 Composition API Refactoring in Practice"
date: 2019-11-25 10:30:46
tags:
  - Vue
readingTime: 5
description: "Vue 3 的 Composition API 引入了一种全新的组件逻辑组织方式。本文通过一个真实的用户管理页面，演示如何用 Composition API 重构 Vue 2 的 Options API 代码，展示 Composable 函数的抽取和复用。"
---

Vue 3 的 Composition API 引入了一种全新的组件逻辑组织方式。本文通过一个真实的用户管理页面，演示如何用 Composition API 重构 Vue 2 的 Options API 代码，展示 Composable 函数的抽取和复用。

## Before Refactoring: Options API

假设有一个用户管理页面，包含搜索、列表展示、分页、编辑弹窗等功能：

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

问题：相关逻辑分散在 `data`、`computed`、`watch`、`methods` 中，随着功能增加，文件会变得很长且难以维护。

## After Refactoring: Composition API

### 抽取 Composable：usePagination

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

### 抽取 Composable：useSearch

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

### 抽取 Composable：useCrud

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

### 抽取 Composable：useConfirm

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

### 重构后的组件

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

按照 Vue 3 的惯例：

1. 文件名和函数名以 `use` 开头
2. 每个 Composable 只负责一个关注点
3. 返回的 ref 和 reactive 对象保持响应性
4. 组合多个 Composable 来构建复杂功能

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

| 特性 | Vue 3 Composable | React Hook |
|------|-----------------|------------|
| 响应性 | 自动追踪依赖 | 需要手动指定依赖数组 |
| 调用顺序 | 无限制 | 必须在顶层调用 |
| 副作用清理 | onUnmounted | useEffect 返回清理函数 |
| 复用方式 | 函数调用 | 函数调用 |
| 状态隔离 | 每次调用创建独立状态 | 每次调用创建独立状态 |

## Summary

- Composition API 通过 `setup()` 函数替代 Options API 的分散写法
- Composable 函数可以将相关逻辑抽取为可复用的模块
- `usePagination`、`useSearch`、`useCrud` 等常见的 Composable 可以跨组件复用
- 命名约定以 `use` 开头，与 React Hooks 一致
- Composition API 不替代 Options API，两者可以共存
- 适合在大型项目中组织复杂逻辑，小型项目用 Options API 也完全足够
