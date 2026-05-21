---
title: "TypeScript 在 Vue 專案中的完整實踐"
date: 2018-11-21 11:03:49
tags:
  - Vue
readingTime: 3
description: "在 Vue 專案裡用 TypeScript 其實比想象中麻煩一些。折騰了兩週，總結一下完整的配置流程。"
wordCount: 413
---

在 Vue 專案裡用 TypeScript 其實比想象中麻煩一些。折騰了兩週，總結一下完整的配置流程。

## 為什麼 Vue + TS 配置複雜

Vue 2 的設計是基於選項物件的（Options API），不是 class 風格，對 TypeScript 的型別推斷不太友好。好在 Vue 提供了 `vue-class-component` 和 `vue-property-decorator`，讓 TS 支援好一些。

Vue 3 會在設計上對 TS 友好很多，但現在我們還在用 Vue 2。

## 專案配置

### 1. 初始化（Vue CLI 3）

```bash
vue create my-ts-app
# 選擇 Manually select features
# 勾選 TypeScript, Babel, Router, Vuex, CSS Pre-processors, Linter
# TypeScript → Use class-style component syntax? → Yes
```

### 2. 依賴安裝

```bash
npm install --save-dev \
  typescript \
  vue-class-component \
  vue-property-decorator \
  vuex-class
```

### 3. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ESNext",
    "strict": true,
    "jsx": "preserve",
    "importHelpers": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "baseUrl": ".",
    "types": ["webpack-env", "jest"],
    "paths": {
      "@/*": ["src/*"]
    },
    "lib": ["ESNext", "DOM", "DOM.Iterable", "ScriptHost"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

## 元件寫法

### Class 風格元件

```typescript
{% raw %}
// src/components/UserProfile.vue
<template>
  <div class="user-profile">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="loadUser">重新整理</button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { User } from '@/types'

@Component
export default class UserProfile extends Vue {
  @Prop({ required: true })
  userId!: number

  user: User | null = null
  loading = false

  async created() {
    await this.loadUser()
  }

  async loadUser() {
    this.loading = true
    try {
      this.user = await fetchUser(this.userId)
    } finally {
      this.loading = false
    }
  }

  get displayName(): string {
    return this.user?.name ?? '載入中...'
  }
}
</script>
{% endraw %}
```

### 型別定義

```typescript
// src/types/index.ts

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

## Vuex 的 TypeScript 支援

這是最麻煩的部分，需要 `vuex-class`：

```typescript
// src/store/modules/user.ts
import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import { User } from "@/types";

@Module({ namespaced: true, name: "user" })
export default class UserModule extends VuexModule {
  currentUser: User | null = null;
  token = "";

  @Mutation
  SET_USER(user: User) {
    this.currentUser = user;
  }

  @Mutation
  SET_TOKEN(token: string) {
    this.token = token;
  }

  @Action({ rawError: true })
  async login(credentials: { username: string; password: string }) {
    const { user, token } = await authLogin(credentials);
    this.SET_USER(user);
    this.SET_TOKEN(token);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }
}
```

```typescript
// 在元件中使用
import { namespace } from "vuex-class";

const UserStore = namespace("user");

@Component
export default class App extends Vue {
  @UserStore.State("currentUser")
  currentUser!: User | null;

  @UserStore.Getter("isLoggedIn")
  isLoggedIn!: boolean;

  @UserStore.Action("login")
  login!: (credentials: {
    username: string;
    password: string;
  }) => Promise<void>;
}
```

## API 請求的型別化

```typescript
// src/api/user.ts
import axios from "axios";
import { User, ApiResponse, PaginatedData } from "@/types";

const request = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL,
  timeout: 10000,
});

export function fetchUser(id: number): Promise<User> {
  return request
    .get<ApiResponse<User>>(`/users/${id}`)
    .then((res) => res.data.data);
}

export function fetchUserList(params: {
  page: number;
  pageSize: number;
  keyword?: string;
}): Promise<PaginatedData<User>> {
  return request
    .get<ApiResponse<PaginatedData<User>>>("/users", { params })
    .then((res) => res.data.data);
}

export function updateUser(
  id: number,
  data: Partial<Omit<User, "id" | "createdAt">>,
): Promise<User> {
  return request
    .put<ApiResponse<User>>(`/users/${id}`, data)
    .then((res) => res.data.data);
}
```

## 遇到的問題

**問題 1：`.vue` 檔案無法識別**

建立型別宣告檔案：

```typescript
// src/shims-vue.d.ts
declare module "*.vue" {
  import Vue from "vue";
  export default Vue;
}
```

**問題 2：global properties 無型別提示**

```typescript
// src/shims-global.d.ts
import Vue from "vue";
import { AxiosInstance } from "axios";

declare module "vue/types/vue" {
  interface Vue {
    $http: AxiosInstance;
    $message: (msg: string) => void;
  }
}
```

**問題 3：class-style 元件裡 this 的型別**

Computed properties 和 methods 裡的 `this` 需要是元件例項型別：

```typescript
// 在 methods 裡定義其他 methods 的型別
methods: {
  handleClick(this: ComponentType): void {
    this.someMethod()
  }
}
```

## 是否值得用 Vue + TS？

說實話，Vue 2 + TS 的體驗比 React + TS 差一些，裝飾器語法也還是提案階段（需要 `experimentalDecorators: true`）。型別推斷在某些 Vue 特有的場景（computed、watch）裡也不夠準確。

但對於大型專案，型別約束帶來的好處（減少低階錯誤、IDE 提示、重構安全性）還是值得的。

等 Vue 3 出來，Composition API + TS 的體驗應該會好很多。

## 小結

- Vue CLI 3 初始化時選 TypeScript，自動處理大部分配置
- 使用 `vue-property-decorator` 寫 class 風格元件
- 型別定義放在 `src/types/index.ts`，全域性複用
- Vuex 用 `vuex-module-decorators` 獲得型別支援
- Vue 2 + TS 體驗不完美，Vue 3 會改善
