---
title: "前端架構設計的思考與實踐"
date: 2020-12-10 09:55:21
tags:
  - 前端
readingTime: 3
description: "做了五年前端，從寫頁面到寫系統，從維護老專案到搭建新架構。今年帶團隊做了一個大型管理後臺專案，沉澱了一些架構設計的思考。"
wordCount: 208
---

做了五年前端，從寫頁面到寫系統，從維護老專案到搭建新架構。今年帶團隊做了一個大型管理後臺專案，沉澱了一些架構設計的思考。

## 架構的核心問題

```
前端架構要解決的三個核心問題：

1. 如何組織程式碼？（目錄結構、模組劃分）
2. 如何管理狀態？（資料流、快取策略）
3. 如何保證質量？（型別、測試、規範）
```

## 目錄結構設計

```
src/
├── assets/              # 靜態資源
├── components/          # 公共元件
│   ├── base/            # 基礎元件（Button、Input）
│   └── business/        # 業務元件（UserSelect、OrderTable）
├── composables/         # 組合式函式（Vue 3）
│   ├── useAuth.ts       # 認證
│   ├── usePagination.ts # 分頁
│   └── useRequest.ts    # 請求
├── layouts/             # 佈局元件
├── router/              # 路由
│   ├── index.ts
│   └── guards.ts        # 路由守衛
├── services/            # API 服務層
│   ├── user.ts
│   ├── order.ts
│   └── http.ts          # Axios 例項
├── store/               # 狀態管理
│   ├── modules/
│   └── index.ts
├── styles/              # 全域性樣式
│   ├── variables.scss
│   ├── mixins.scss
│   └── global.scss
├── types/               # TypeScript 型別
│   ├── api.ts           # API 響應型別
│   ├── model.ts         # 業務模型型別
│   └── store.ts         # Store 型別
├── utils/               # 工具函式
│   ├── format.ts
│   ├── validate.ts
│   └── storage.ts
├── views/               # 頁面
│   ├── dashboard/
│   ├── user/
│   └── order/
└── main.ts
```

## API 服務層設計

```typescript
// services/http.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const http = axios.create({
  baseURL: process.env.VUE_APP_API_BASE,
  timeout: 10000,
});

// 請求攔截：token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 響應攔截：統一錯誤處理
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, data, message } = response.data;
    if (code === 0) return data;
    // 業務錯誤
    return Promise.reject(new Error(message || '請求失敗'));
  },
  error => {
    if (error.response?.status === 401) {
      // token 過期，跳轉登入
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default http;
```

```typescript
// services/user.ts
import http from './http';
import type { User, UserQuery, PaginatedResult } from '@/types/model';

export const userService = {
  // 獲取使用者列表
  getList(params: UserQuery): Promise<PaginatedResult<User>> {
    return http.get('/users', { params });
  },

  // 獲取使用者詳情
  getById(id: number): Promise<User> {
    return http.get(`/users/${id}`);
  },

  // 建立使用者
  create(data: Partial<User>): Promise<User> {
    return http.post('/users', data);
  },

  // 更新使用者
  update(id: number, data: Partial<User>): Promise<User> {
    return http.put(`/users/${id}`, data);
  },

  // 刪除使用者
  delete(id: number): Promise<void> {
    return http.delete(`/users/${id}`);
  },
};
```

## 狀態管理策略

```typescript
// 不是什麼都要放 Vuex/Pinia
// 狀態分層：

// 1. 元件內狀態：useState / ref / reactive
//    只在元件內使用，不需要共享
//    例如：表單輸入、彈窗開關

// 2. 全域性業務狀態：Pinia / Vuex
//    多個元件/頁面共享
//    例如：使用者資訊、許可權、全域性配置

// 3. 服務端狀態：快取 + 請求
//    從 API 獲取的資料
//    例如：列表資料、詳情資料

// store/modules/auth.ts
import { defineStore } from 'pinia';
import { authService } from '@/services/auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null as User | null,
    permissions: [] as string[],
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    hasPermission: (state) => (perm: string) => state.permissions.includes(perm),
  },

  actions: {
    async login(credentials: { username: string; password: string }) {
      const { token, user, permissions } = await authService.login(credentials);
      this.token = token;
      this.user = user;
      this.permissions = permissions;
      localStorage.setItem('token', token);
    },

    logout() {
      this.token = '';
      this.user = null;
      this.permissions = [];
      localStorage.removeItem('token');
    },
  },
});
```

## 許可權設計

```typescript
// utils/permission.ts
import { useAuthStore } from '@/store/modules/auth';

// 指令方式
export const vPermission = {
  mounted(el: HTMLElement, binding: { value: string | string[] }) {
    const authStore = useAuthStore();
    const perms = Array.isArray(binding.value) ? binding.value : [binding.value];
    const hasPerm = perms.some(p => authStore.hasPermission(p));
    if (!hasPerm) {
      el.parentNode?.removeChild(el);
    }
  },
};

// 元件方式
// <template>
//   <permission :required="['user:create']">
//     <button>新增使用者</button>
//   </permission>
// </template>
```

## 路由設計

```typescript
// router/index.ts
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/Index.vue'),
        meta: { title: '儀表盤', icon: 'dashboard' },
      },
      {
        path: 'user',
        name: 'User',
        redirect: '/user/list',
        meta: { title: '使用者管理', icon: 'user', permission: 'user:view' },
        children: [
          {
            path: 'list',
            name: 'UserList',
            component: () => import('@/views/user/List.vue'),
            meta: { title: '使用者列表' },
          },
          {
            path: ':id',
            name: 'UserDetail',
            component: () => import('@/views/user/Detail.vue'),
            meta: { title: '使用者詳情', hidden: true },
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Index.vue'),
    meta: { title: '登入', layout: 'blank' },
  },
];
```

## 錯誤邊界處理

```typescript
// utils/error-handler.ts
export function setupErrorHandler(app) {
  // Vue 全域性錯誤處理
  app.config.errorHandler = (err, vm, info) => {
    console.error('Vue 錯誤:', err);
    // 上報到監控平臺
    reportError({
      type: 'vue-error',
      error: err.message,
      stack: err.stack,
      component: vm?.$options?.name,
      info,
    });
  };

  // JS 全域性錯誤
  window.addEventListener('error', (event) => {
    reportError({
      type: 'js-error',
      error: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  // Promise 未捕獲錯誤
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise-rejection',
      error: event.reason?.message || String(event.reason),
    });
  });
}
```

## 小結

- 架構的核心是讓程式碼結構清晰、團隊協作高效
- 分層設計：元件層、業務層、服務層、基礎設施層
- API 服務層統一管理請求，型別定義保證介面契約
- 狀態管理按範圍分層，不是所有狀態都需要全域性管理
- 許可權、路由、錯誤處理是企業級應用的基礎設施，優先設計
