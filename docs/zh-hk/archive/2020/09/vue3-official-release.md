---
title: "Vue 3.0 正式發佈：Composition API 完全上手"
date: 2020-09-28 10:39:27
tags:
  - Vue
readingTime: 2
description: "一等再等，Vue 3.0 \"One Piece\" 上週正式發佈了！跟蹤了將近一年的 alpha/beta，終於來了。這篇文章是系統性的上手指南。"
---

一等再等，Vue 3.0 "One Piece" 上週正式發佈了！跟蹤了將近一年的 alpha/beta，終於來了。這篇文章是系統性的上手指南。

## 安裝

```bash
npm init @vitejs/app my-vue3-app -- --template vue-ts
# 或者
npm init vite-app my-app
cd my-app && npm install && npm run dev
```

## Composition API 實戰

```vue
{% raw %}
<template>
  <div class="user-list">
    <input v-model="searchQuery" placeholder="搜索用户" />

    <div v-if="loading">加載中...</div>
    <div v-else-if="error">{{ error }}</div>
    <ul v-else>
      <li v-for="user in filteredUsers" :key="user.id">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>

    <Pagination v-model:page="page" :total="total" />
  </div>
</template>

<script setup lang="ts">
// Vue 3.2 的 <script> 語法（現在還是 RFC，但已經可以用）
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

// 類型定義
interface User {
  id: number;
  name: string;
  email: string;
}

// 狀態
const searchQuery = ref("");
const users = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const total = ref(0);

// 計算屬性
const filteredUsers = computed(() =>
  users.value.filter(
    (u) =>
      u.name.includes(searchQuery.value) || u.email.includes(searchQuery.value),
  ),
);

// 數據獲取
async function loadUsers() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/users?page=${page.value}`);
    const data = await res.json();
    users.value = data.list;
    total.value = data.total;
  } catch (e) {
    error.value = "加載失敗，請重試";
  } finally {
    loading.value = false;
  }
}

// 監聽
watch(page, loadUsers);

onMounted(loadUsers);
</script>
{% endraw %}
```

## Composables：邏輯複用

```typescript
// composables/useFetch.ts
import { ref, shallowRef } from "vue";

export function useFetch<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function execute() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetcher();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "請求失敗";
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, execute };
}

// 使用
const {
  data: users,
  loading,
  execute: loadUsers,
} = useFetch(() => api.getUsers({ page: page.value }));
```

## 和 Vue 2 的重大變化

```typescript
// 生命週期重命名
// beforeDestroy → onBeforeUnmount
// destroyed → onUnmounted
// beforeCreate/created → 直接寫在 setup 裏

// 全局 API
// Vue 2：Vue.use() / Vue.component() / Vue.prototype
// Vue 3：app.use() / app.component() / app.config.globalProperties

// main.ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

const app = createApp(App);
app.use(router);
app.use(store);
app.config.globalProperties.$http = axios; // 替代 Vue.prototype.$http
app.mount("#app");
```

## v-model 的變化

```vue
<!-- Vue 2：v-model = :value + @input -->
<!-- 自定義組件用 model 選項 -->

<!-- Vue 3：v-model 更靈活 -->
<!-- 默認：v-model = :modelValue + @update:modelValue -->
<MyInput v-model="name" />
<!-- 等價於 -->
<MyInput :modelValue="name" @update:modelValue="name = $event" />

<!-- 多個 v-model -->
<UserForm v-model:name="name" v-model:email="email" />
```

## Teleport（傳送門）

```vue
<!-- 把組件渲染到 DOM 中的其他位置 -->
<template>
  <button @click="showModal = true">打開彈窗</button>

  <!-- Teleport 到 body，解決 z-index 和 overflow 問題 -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <h2>彈窗標題</h2>
        <button @click="showModal = false">關閉</button>
      </div>
    </div>
  </Teleport>
</template>
```

## Vue 3 生態現狀（2020年9月）

- **Vue Router 4**：已有 RC 版，和 Vue 3 配套
- **Vuex 4**：同時支持 Vue 2/3
- **Element Plus**：Element UI 的 Vue 3 版，還在開發中
- **Vite**：Vue 3 官方推薦構建工具

大部分第三方庫還需要時間遷移，生產項目暫時觀望，新項目可以開始用了。

## 小結

- Vue 3 不是顛覆，是演進。Composition API 是加法，Options API 還在
- `setup()` 或 `<script>` 是新的寫法方式，更靈活
- Composables 替代 Mixin，來源清晰，類型友好
- `Teleport`、`Suspense` 解決了 Vue 2 的痛點
- 生態還需要 6-12 個月成熟，但已經可以在新項目中使用
