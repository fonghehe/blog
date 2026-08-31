---
title: "Vue 3 Composition APIリファクタリング実践"
date: 2019-11-25 10:30:46
tags:
  - Vue
readingTime: 6
description: "Vue 3 的 Composition API 引入了一种全新的组件逻辑组织方式。本文通过一个真实的用户管理页面，演示如何用 Composition API 重构 Vue 2 的 Options API 代码，展示 Composable 函数的抽取和复用。"
wordCount: 698
---

Vue 3 の Composition API は、コンポーネントのロジックを構成するまったく新しい方法を導入しました。本記事では実際のユーザー管理画面を例に、Composition API を使って Vue 2 の Options API のコードをリファクタリングする方法を紹介し、Composable 関数の抽出と再利用を示します。

## リファクタリング前：Options API

検索、一覧表示、ページネーション、編集ダイアログなどの機能を持つユーザー管理画面があったとします：

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

問題点：関連するロジックが `data`、`computed`、`watch`、`methods` に分散しており、機能が増えるにつれてファイルが非常に長くなり、保守が難しくなります。

## リファクタリング後：Composition API

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

### リファクタリング後のコンポーネント

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

## Composableの命名規約

Vue 3 の慣習に従うと：

1. ファイル名と関数名は `use` で始める
2. 各 Composable は 1 つの関心事だけを担う
3. 返される ref や reactive オブジェクトはリアクティブ性を維持する
4. 複数の Composable を組み合わせて複雑な機能を構築する

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

## React Hooksとの比較

| 特性 | Vue 3 Composable | React Hook |
|------|-----------------|------------|
| 応答性 | 依存関係を自動追跡 | 依存配列を手動で指定する必要がある |
| 呼び出し順序 | 制限なし | トップレベルでのみ呼び出しが必要 |
| 副作用のクリーンアップ | onUnmounted | useEffect がクリーンアップ関数を返す |
| 再利用方法 | 関数呼び出し | 関数呼び出し |
| 状態の分離 | 呼び出しごとに独立した状態が作成される | 呼び出しごとに独立した状態が作成される |

## まとめ

- Composition API は `setup()` 関数で Options API の分散した書き方を置き換えます
- Composable 関数は関連するロジックを再利用可能なモジュールとして抽出できます
- `usePagination`、`useSearch`、`useCrud` などの一般的な Composable はコンポーネントをまたいで再利用できます
- 命名規則は `use` で始め、React Hooks と一致しています
- Composition API は Options API を置き換えるものではなく、両者は共存できます
- 複雑なロジックを整理するのに大規模なプロジェクトに向いており、小規模なプロジェクトなら Options API で十分な場合もあります
