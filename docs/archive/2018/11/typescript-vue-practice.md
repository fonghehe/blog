---
title: "TypeScript 在 Vue 项目中的完整实践"
date: 2018-11-21 11:03:49
tags:
  - Vue
readingTime: 3
description: "在 Vue 项目里用 TypeScript 其实比想象中麻烦一些。折腾了两周，总结一下完整的配置流程。"
wordCount: 412
---

在 Vue 项目里用 TypeScript 其实比想象中麻烦一些。折腾了两周，总结一下完整的配置流程。

## 为什么 Vue + TS 配置复杂

Vue 2 的设计是基于选项对象的（Options API），不是 class 风格，对 TypeScript 的类型推断不太友好。好在 Vue 提供了 `vue-class-component` 和 `vue-property-decorator`，让 TS 支持好一些。

Vue 3 会在设计上对 TS 友好很多，但现在我们还在用 Vue 2。

## 项目配置

### 1. 初始化（Vue CLI 3）

```bash
vue create my-ts-app
# 选择 Manually select features
# 勾选 TypeScript, Babel, Router, Vuex, CSS Pre-processors, Linter
# TypeScript → Use class-style component syntax? → Yes
```

### 2. 依赖安装

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

## 组件写法

### Class 风格组件

```typescript
{% raw %}
// src/components/UserProfile.vue
<template>
  <div class="user-profile">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="loadUser">刷新</button>
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
    return this.user?.name ?? '加载中...'
  }
}
</script>
{% endraw %}
```

### 类型定义

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

## Vuex 的 TypeScript 支持

这是最麻烦的部分，需要 `vuex-class`：

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
// 在组件中使用
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

## API 请求的类型化

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

## 遇到的问题

**问题 1：`.vue` 文件无法识别**

创建类型声明文件：

```typescript
// src/shims-vue.d.ts
declare module "*.vue" {
  import Vue from "vue";
  export default Vue;
}
```

**问题 2：global properties 无类型提示**

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

**问题 3：class-style 组件里 this 的类型**

Computed properties 和 methods 里的 `this` 需要是组件实例类型：

```typescript
// 在 methods 里定义其他 methods 的类型
methods: {
  handleClick(this: ComponentType): void {
    this.someMethod()
  }
}
```

## 是否值得用 Vue + TS？

说实话，Vue 2 + TS 的体验比 React + TS 差一些，装饰器语法也还是提案阶段（需要 `experimentalDecorators: true`）。类型推断在某些 Vue 特有的场景（computed、watch）里也不够准确。

但对于大型项目，类型约束带来的好处（减少低级错误、IDE 提示、重构安全性）还是值得的。

等 Vue 3 出来，Composition API + TS 的体验应该会好很多。

## 小结

- Vue CLI 3 初始化时选 TypeScript，自动处理大部分配置
- 使用 `vue-property-decorator` 写 class 风格组件
- 类型定义放在 `src/types/index.ts`，全局复用
- Vuex 用 `vuex-module-decorators` 获得类型支持
- Vue 2 + TS 体验不完美，Vue 3 会改善
