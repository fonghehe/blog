---
title: "Vue 3.0 正式リリース：Composition APIを使いこなす"
date: 2020-09-28 10:39:27
tags:
  - Vue
readingTime: 3
description: "待望の Vue 3.0 One Piece が先週正式にリリースされました！約 1 年にわたる alpha/beta を追いかけてきて、ついに正式版が登場しました。この記事は体系的な入門ガイドです。"
wordCount: 393
---

待ちに待った Vue 3.0 "One Piece" が先週正式にリリースされました！約 1 年にわたって alpha/beta を追いかけてきましたが、ついに正式版が登場しました。この記事は体系的な入門ガイドです。

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
// Vue 3.2 の <script setup> 構文（現在は RFC ですが、すでに使用可能です）
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

// 型定義
interface User {
  id: number;
  name: string;
  email: string;
}

// 状態
const searchQuery = ref("");
const users = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const total = ref(0);

// 算出プロパティ
const filteredUsers = computed(() =>
  users.value.filter(
    (u) =>
      u.name.includes(searchQuery.value) || u.email.includes(searchQuery.value),
  ),
);

// データ取得
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

// 監視
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
// ライフサイクルの改名
// beforeDestroy → onBeforeUnmount
// destroyed → onUnmounted
// beforeCreate/created → setup 内で直接記述

// グローバル API
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
app.config.globalProperties.$http = axios; // Vue.prototype.$http の代替
app.mount("#app");
```

## v-model 的变化

```vue
<!-- Vue 2：v-model = :value + @input -->
<!-- カスタムコンポーネントは model オプションを使用 -->

<!-- Vue 3：v-model はより柔軟 -->
<!-- デフォルト：v-model = :modelValue + @update:modelValue -->
<MyInput v-model="name" />
<!-- 次と同等 -->
<MyInput :modelValue="name" @update:modelValue="name = $event" />

<!-- 複数の v-model -->
<UserForm v-model:name="name" v-model:email="email" />
```

## Teleport（传送门）

```vue
<!-- コンポーネントを DOM 内の他の場所にレンダリング -->
<template>
  <button @click="showModal = true">打开弹窗</button>

  <!-- body に Teleport し、z-index と overflow の問題を解決 -->
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

- **Vue Router 4**：RC 版がすでにリリースされており、Vue 3 に対応しています
- **Vuex 4**：Vue 2/3 の両方をサポート
- **Element Plus**：Element UI の Vue 3 版で、開発中です
- **Vite**：Vue 3 公式推奨のビルドツール

ほとんどのサードパーティライブラリは移行にまだ時間がかかります。本番プロジェクトはしばらく様子を見て、新規プロジェクトでは使い始めることができます。

## まとめ

- Vue 3 は破壊的な変更ではなく、進化です。Composition API は追加であり、Options API も引き続き使用できます。
- `setup()` または `<script setup>` は新しい書き方で、より柔軟です。
- Composables が Mixin を置き換え、ソースが明確で型に優しいです。
- `Teleport`、`Suspense` は Vue 2 の悩みを解決しました。
- エコシステムの成熟にはあと 6〜12 か月かかりますが、新しいプロジェクトではすでに使用できます。
