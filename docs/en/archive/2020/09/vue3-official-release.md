---
title: "Vue 3.0 Official Release: Getting Started with Composition API"
date: 2020-09-28 10:39:27
tags:
  - Vue
readingTime: 2
description: "After a long wait, Vue 3.0 'One Piece' was officially released last week — we followed the alpha and beta releases for almost a year, and it's finally here. This is a systematic getting-started guide."
wordCount: 189
---

After endless waiting, Vue 3.0 "One Piece" was officially released last week! After nearly a year of tracking the alpha/beta, it's finally here. This article is a systematic getting-started guide.

## Installation

```bash
npm init @vitejs/app my-vue3-app -- --template vue-ts
# 或者
npm init vite-app my-app
cd my-app && npm install && npm run dev
```

## Composition API in Practice

```vue
{% raw %}
<template>
  <div class="user-list">
    <input v-model="searchQuery" placeholder="搜索用户" />

    <div v-if="loading">加载中...</div>
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
// Vue 3.2 的 <script> 语法（现在还是 RFC，但已经可以用）
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

// 类型定义
interface User {
  id: number;
  name: string;
  email: string;
}

// 状态
const searchQuery = ref("");
const users = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const total = ref(0);

// 计算属性
const filteredUsers = computed(() =>
  users.value.filter(
    (u) =>
      u.name.includes(searchQuery.value) || u.email.includes(searchQuery.value),
  ),
);

// 数据获取
async function loadUsers() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/users?page=${page.value}`);
    const data = await res.json();
    users.value = data.list;
    total.value = data.total;
  } catch (e) {
    error.value = "加载失败，请重试";
  } finally {
    loading.value = false;
  }
}

// 监听
watch(page, loadUsers);

onMounted(loadUsers);
</script>
{% endraw %}
```

## Composables: Logic Reuse

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
      error.value = e instanceof Error ? e.message : "请求失败";
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

## Major Changes from Vue 2

```typescript
// 生命周期重命名
// beforeDestroy → onBeforeUnmount
// destroyed → onUnmounted
// beforeCreate/created → 直接写在 setup 里

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

## Changes to v-model

```vue
<!-- Vue 2：v-model = :value + @input -->
<!-- 自定义组件用 model 选项 -->

<!-- Vue 3：v-model 更灵活 -->
<!-- 默认：v-model = :modelValue + @update:modelValue -->
<MyInput v-model="name" />
<!-- 等价于 -->
<MyInput :modelValue="name" @update:modelValue="name = $event" />

<!-- 多个 v-model -->
<UserForm v-model:name="name" v-model:email="email" />
```

## Teleport

```vue
<!-- 把组件渲染到 DOM 中的其他位置 -->
<template>
  <button @click="showModal = true">打开弹窗</button>

  <!-- Teleport 到 body，解决 z-index 和 overflow 问题 -->
  <Teleport to="body">
    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <h2>弹窗标题</h2>
        <button @click="showModal = false">关闭</button>
      </div>
    </div>
  </Teleport>
</template>
```

## The Vue 3 Ecosystem Status (September 2020)

- **Vue Router 4**: already has an RC and pairs with Vue 3
- **Vuex 4**: supports both Vue 2 and Vue 3
- **Element Plus**: the Vue 3 version of Element UI, still in development
- **Vite**: Vue 3's officially recommended build tool

Most third-party libraries still need time to migrate — for production projects it's best to wait and see for now, but new projects can start using it.

## Summary

- Vue 3 isn't a disruption, it's an evolution. The Composition API is additive — the Options API is still here.
- `setup()` or `<script setup>` is the new way to write components, and it's more flexible.
- Composables replace Mixins — clearer sources and type-friendly.
- `Teleport` and `Suspense` solve pain points from Vue 2.
- The ecosystem still needs 6–12 months to mature, but it's already usable in new projects.
