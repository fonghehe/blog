---
title: "Vue 3.0 正式发布：Composition API 完全上手"
date: 2020-09-28 10:39:27
tags:
  - Vue
---

一等再等，Vue 3.0 "One Piece" 上周正式发布了！跟踪了将近一年的 alpha/beta，终于来了。这篇文章是系统性的上手指南。

## 安装

```bash
npm init @vitejs/app my-vue3-app -- --template vue-ts
# 或者
npm init vite-app my-app
cd my-app && npm install && npm run dev
```

## Composition API 实战

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

## Composables：逻辑复用

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

## 和 Vue 2 的重大变化

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

## v-model 的变化

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

## Teleport（传送门）

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

## Vue 3 生态现状（2020年9月）

- **Vue Router 4**：已有 RC 版，和 Vue 3 配套
- **Vuex 4**：同时支持 Vue 2/3
- **Element Plus**：Element UI 的 Vue 3 版，还在开发中
- **Vite**：Vue 3 官方推荐构建工具

大部分第三方库还需要时间迁移，生产项目暂时观望，新项目可以开始用了。

## 小结

- Vue 3 不是颠覆，是演进。Composition API 是加法，Options API 还在
- `setup()` 或 `<script>` 是新的写法方式，更灵活
- Composables 替代 Mixin，来源清晰，类型友好
- `Teleport`、`Suspense` 解决了 Vue 2 的痛点
- 生态还需要 6-12 个月成熟，但已经可以在新项目中使用
