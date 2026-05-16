---
title: "A Complete TypeScript Practice Guide for Vue Projects"
date: 2018-11-21 11:03:49
tags:
  - Vue
readingTime: 2
description: "Using TypeScript in a Vue project is more complicated than it sounds. After two weeks of wrestling with it, here's a complete walkthrough of the configuration."
---

Using TypeScript in a Vue project is more complicated than it sounds. After two weeks of wrestling with it, here's a complete walkthrough of the configuration.

## Why Vue + TS Configuration Is Complex

Vue 2's design is based on options objects (Options API) rather than class-style patterns, which is not very friendly to TypeScript's type inference. Fortunately, Vue provides `vue-class-component` and `vue-property-decorator` to improve TS support.

Vue 3 will be much more TS-friendly by design, but for now we're still on Vue 2.

## Project Setup

### 1. Initialization (Vue CLI 3)

```bash
vue create my-ts-app
# Choose: Manually select features
# Check: TypeScript, Babel, Router, Vuex, CSS Pre-processors, Linter
# TypeScript → Use class-style component syntax? → Yes
```

### 2. Install Dependencies

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

## Component Patterns

### Class-style Component

```typescript
{% raw %}
// src/components/UserProfile.vue
<template>
  <div class="user-profile">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="loadUser">Refresh</button>
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
    return this.user?.name ?? 'Loading...'
  }
}
</script>
{% endraw %}
```

### Type Definitions

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

## Vuex with TypeScript

This is the trickiest part — it requires `vuex-class`:

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
// Using in a component
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

## Summary

- Vue 2 requires `vue-class-component` and `vue-property-decorator` for good TS support
- Vue 3's Composition API is designed to be TS-friendly from the start — much cleaner
- Define shared types in `src/types/index.ts`
- `vuex-class` provides typed access to Vuex state, getters, and actions
