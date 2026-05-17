---
title: "TypeScript の Vue プロジェクトでの完全な実践"
date: 2018-11-21 11:03:49
tags:
  - Vue
readingTime: 2
description: "Vue プロジェクトで TypeScript を使うのは想像より面倒です。2 週間格闘して、完全な設定フローをまとめます。"
---

Vue プロジェクトで TypeScript を使うのは想像より面倒です。2 週間格闘して、完全な設定フローをまとめます。

## Vue + TS の設定が複雑な理由

Vue 2 の設計はオプションオブジェクトベース（Options API）でクラス風ではないため、TypeScript の型推論と相性があまりよくありません。`vue-class-component` と `vue-property-decorator` が提供されており、TS サポートが改善されています。

Vue 3 は設計上で TS により親しみやすくなりますが、今は Vue 2 を使っています。

## プロジェクト設定

### 1. 初期化（Vue CLI 3）

```bash
vue create my-ts-app
# Manually select features を選択
# TypeScript, Babel, Router, Vuex, CSS Pre-processors, Linter にチェック
# TypeScript → Use class-style component syntax? → Yes
```

### 2. 依存パッケージのインストール

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

## コンポーネントの書き方

### クラス風コンポーネント

```typescript
{% raw %}
// src/components/UserProfile.vue
<template>
  <div class="user-profile">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="loadUser">更新</button>
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
    return this.user?.name ?? '読み込み中...'
  }
}
</script>
{% endraw %}
```

### 型定義

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

## Vuex の TypeScript サポート

これが最も面倒な部分で、`vuex-class` が必要です：

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
// コンポーネントでの使用
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

## API リクエストの型付け

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
```

## まとめ

- Vue 2 + TS は `vue-class-component` と `vue-property-decorator` でサポートを改善
- `strict: true` は最初から有効にすることを推奨
- Vuex の型付けは面倒だが `vuex-class` で改善できる
- Vue 3 は設計上で TS により友好的で、Composition API との組み合わせが美しい
