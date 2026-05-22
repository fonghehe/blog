---
title: "Vue 3 Composition API 重構實踐：落地路徑與實戰建議"
date: 2019-11-25 10:30:46
tags:
  - Vue
readingTime: 5
description: "Vue 3 的 Composition API 引入了一種全新的組件邏輯組織方式。本文通過一個真實的用户管理頁面，演示如何用 Composition API 重構 Vue 2 的 Options API 代碼，展示 Composable 函數的抽取和複用。"
wordCount: 418
---

Vue 3 的 Composition API 引入了一種全新的組件邏輯組織方式。本文通過一個真實的用户管理頁面，演示如何用 Composition API 重構 Vue 2 的 Options API 代碼，展示 Composable 函數的抽取和複用。

## 重構前：Options API

假設有一個用户管理頁面，包含搜索、列表展示、分頁、編輯彈窗等功能：

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

    <div v-if="loading" class="loading">加載中...</div>

    <table v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>郵箱</th>
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
            <button @click="editUser(user)">編輯</button>
            <button @click="deleteUser(user.id)">刪除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一頁</button>
      <span>第 {{ page }} / {{ totalPages }} 頁</span>
      <button :disabled="page === totalPages" @click="changePage(page + 1)">下一頁</button>
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
        console.error('獲取用户列表失敗:', error);
      } finally {
        this.loading = false;
      }
    },

    handleSearch() {
      // 防抖處理
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
      if (!confirm('確定刪除？')) return;
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

問題：相關邏輯分散在 `data`、`computed`、`watch`、`methods` 中，隨着功能增加，文件會變得很長且難以維護。

## 重構後：Composition API

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

  // 也可以用 watch 實現
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
      console.error('獲取數據失敗:', error);
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

  async function confirmDelete(message = '確定刪除？') {
    return confirm(message);
  }

  return { confirm, confirmDelete };
}
```

### 重構後的組件

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

    <div v-if="loading" class="loading">加載中...</div>

    <table v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>郵箱</th>
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
            <button @click="edit(user)">編輯</button>
            <button @click="handleDelete(user.id)">刪除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一頁</button>
      <span>第 {{ page }} / {{ totalPages }} 頁</span>
      <button :disabled="page === totalPages" @click="changePage(page + 1)">下一頁</button>
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

## Composable 的命名規範

按照 Vue 3 的慣例：

1. 文件名和函數名以 `use` 開頭
2. 每個 Composable 隻負責一個關注點
3. 返回的 ref 和 reactive 對象保持響應性
4. 組合多個 Composable 來構建複雜功能

```
composables/
├── usePagination.js    // 分頁邏輯
├── useSearch.js        // 搜索邏輯
├── useCrud.js          // CRUD 操作
├── useConfirm.js       // 確認對話框
├── useMousePosition.js // 鼠標位置
├── useDebounce.js      // 防抖
├── useThrottle.js      // 節流
└── useFetch.js         // 數據獲取
```

## 與 React Hooks 的對比

| 特性 | Vue 3 Composable | React Hook |
|
------|-----------------|------------|
| 響應性 | 自動追蹤依賴 | 需要手動指定依賴數組 |
| 調用順序 | 無限製 | 必須在頂層調用 |
| 副作用清理 | onUnmounted | useEffect 返回清理函數 |
| 複用方式 | 函數調用 | 函數調用 |
| 狀態隔離 | 每次調用創建獨立狀態 | 每次調用創建獨立狀態 |

## 小結

- Composition API 通過 `setup()` 函數替代 Options API 的分散寫法
- Composable 函數可以將相關邏輯抽取為可複用的模塊
- `usePagination`、`useSearch`、`useCrud` 等常見的 Composable 可以跨組件複用
- 命名約定以 `use` 開頭，與 React Hooks 一致
- Composition API 不替代 Options API，兩者可以共存
- 適合在大型項目中組織複雜邏輯，小型項目用 Options API 也完全足夠
