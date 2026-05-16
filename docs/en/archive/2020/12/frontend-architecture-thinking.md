---
title: "Thoughts and Practice on Frontend Architecture Design"
date: 2020-12-10 09:55:21
tags:
  - Frontend
readingTime: 3
description: "做了五年前端，从写页面到写系统，从维护老项目到搭建新架构。今年带团队做了一个大型管理后台项目，沉淀了一些架构设计的思考。"
---

做了五年前端，从写页面到写系统，从维护老项目到搭建新架构。今年带团队做了一个大型管理后台项目，沉淀了一些架构设计的思考。

## Core Questions of Architecture

```
前端架构要解决的三个核心问题：

1. 如何组织代码？（目录结构、模块划分）
2. 如何管理状态？（数据流、缓存策略）
3. 如何保证质量？（类型、测试、规范）
```

## 目录结构设计

```
src/
├── assets/              # 静态资源
├── components/          # 公共组件
│   ├── base/            # 基础组件（Button、Input）
│   └── business/        # 业务组件（UserSelect、OrderTable）
├── composables/         # 组合式函数（Vue 3）
│   ├── useAuth.ts       # 认证
│   ├── usePagination.ts # 分页
│   └── useRequest.ts    # 请求
├── layouts/             # 布局组件
├── router/              # 路由
│   ├── index.ts
│   └── guards.ts        # 路由守卫
├── services/            # API 服务层
│   ├── user.ts
│   ├── order.ts
│   └── http.ts          # Axios 实例
├── store/               # 状态管理
│   ├── modules/
│   └── index.ts
├── styles/              # 全局样式
│   ├── variables.scss
│   ├── mixins.scss
│   └── global.scss
├── types/               # TypeScript 类型
│   ├── api.ts           # API 响应类型
│   ├── model.ts         # 业务模型类型
│   └── store.ts         # Store 类型
├── utils/               # 工具函数
│   ├── format.ts
│   ├── validate.ts
│   └── storage.ts
├── views/               # 页面
│   ├── dashboard/
│   ├── user/
│   └── order/
└── main.ts
```

## API Service Layer Design

```typescript
// services/http.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const http = axios.create({
  baseURL: process.env.VUE_APP_API_BASE,
  timeout: 10000,
});

// 请求拦截：token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一错误处理
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, data, message } = response.data;
    if (code === 0) return data;
    // 业务错误
    return Promise.reject(new Error(message || '请求失败'));
  },
  error => {
    if (error.response?.status === 401) {
      // token 过期，跳转登录
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
  // 获取用户列表
  getList(params: UserQuery): Promise<PaginatedResult<User>> {
    return http.get('/users', { params });
  },

  // 获取用户详情
  getById(id: number): Promise<User> {
    return http.get(`/users/${id}`);
  },

  // 创建用户
  create(data: Partial<User>): Promise<User> {
    return http.post('/users', data);
  },

  // 更新用户
  update(id: number, data: Partial<User>): Promise<User> {
    return http.put(`/users/${id}`, data);
  },

  // 删除用户
  delete(id: number): Promise<void> {
    return http.delete(`/users/${id}`);
  },
};
```

## State Management Strategy

```typescript
// 不是什么都要放 Vuex/Pinia
// 状态分层：

// 1. 组件内状态：useState / ref / reactive
//    只在组件内使用，不需要共享
//    例如：表单输入、弹窗开关

// 2. 全局业务状态：Pinia / Vuex
//    多个组件/页面共享
//    例如：用户信息、权限、全局配置

// 3. 服务端状态：缓存 + 请求
//    从 API 获取的数据
//    例如：列表数据、详情数据

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

## Permission Design

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

// 组件方式
// <template>
//   <permission :required="['user:create']">
//     <button>新增用户</button>
//   </permission>
// </template>
```

## Routing Design

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
        meta: { title: '仪表盘', icon: 'dashboard' },
      },
      {
        path: 'user',
        name: 'User',
        redirect: '/user/list',
        meta: { title: '用户管理', icon: 'user', permission: 'user:view' },
        children: [
          {
            path: 'list',
            name: 'UserList',
            component: () => import('@/views/user/List.vue'),
            meta: { title: '用户列表' },
          },
          {
            path: ':id',
            name: 'UserDetail',
            component: () => import('@/views/user/Detail.vue'),
            meta: { title: '用户详情', hidden: true },
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Index.vue'),
    meta: { title: '登录', layout: 'blank' },
  },
];
```

## Error Boundary Handling

```typescript
// utils/error-handler.ts
export function setupErrorHandler(app) {
  // Vue 全局错误处理
  app.config.errorHandler = (err, vm, info) => {
    console.error('Vue 错误:', err);
    // 上报到监控平台
    reportError({
      type: 'vue-error',
      error: err.message,
      stack: err.stack,
      component: vm?.$options?.name,
      info,
    });
  };

  // JS 全局错误
  window.addEventListener('error', (event) => {
    reportError({
      type: 'js-error',
      error: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  // Promise 未捕获错误
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise-rejection',
      error: event.reason?.message || String(event.reason),
    });
  });
}
```

## Summary

- 架构的核心是让代码结构清晰、团队协作高效
- 分层设计：组件层、业务层、服务层、基础设施层
- API 服务层统一管理请求，类型定义保证接口契约
- 状态管理按范围分层，不是所有状态都需要全局管理
- 权限、路由、错误处理是企业级应用的基础设施，优先设计
