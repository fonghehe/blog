---
title: "フロントエンドアーキテクチャ設計の考察と実践"
date: 2020-12-10 09:55:21
tags:
  - フロントエンド
readingTime: 3
description: "フロントエンドの開発を 5 年経験し、ページを書くことからシステムを構築することへ、レガシープロジェクトのメンテナンスから新しいアーキテクチャの構築へと進んできました。今年はチームを率いて大規模な管理画面プロジェクトに取り組み、アーキテクチャ設計に関するいくつかの知見が得られました。"
wordCount: 395
---

フロントエンド開発を 5 年経験し、ページを書くことからシステムを構築することへ、レガシープロジェクトのメンテナンスから新しいアーキテクチャの構築へと進んできました。今年はチームを率いて大規模な管理画面プロジェクトに取り組み、アーキテクチャ設計に関するいくつかの知見が得られました。

## アーキテクチャの核心的な問い

```
フロントエンドアーキテクチャが解決すべき 3 つの核心的な問題：

1. コードをどのように構成するか？（ディレクトリ構造、モジュール分割）
2. 状態をどのように管理するか？（データフロー、キャッシュ戦略）
3. 品質をどのように保証するか？（型、テスト、規約）
```

## ディレクトリ構造設計

```
src/
├── assets/              # 静的リソース
├── components/          # 公開コンポーネント
│   ├── base/            # 基礎コンポーネント（Button、Input）
│   └── business/        # 業務コンポーネント（UserSelect、OrderTable）
├── composables/         # コンポーザブル関数（Vue 3）
│   ├── useAuth.ts       # 認証
│   ├── usePagination.ts # ページネーション
│   └── useRequest.ts    # リクエスト
├── layouts/             # レイアウトコンポーネント
├── router/              # ルーター
│   ├── index.ts
│   └── guards.ts        # ルートガード
├── services/            # API サービス層
│   ├── user.ts
│   ├── order.ts
│   └── http.ts          # Axios インスタンス
├── store/               # 状態管理
│   ├── modules/
│   └── index.ts
├── styles/              # グローバルスタイル
│   ├── variables.scss
│   ├── mixins.scss
│   └── global.scss
├── types/               # TypeScript 型
│   ├── api.ts           # API レスポンス型
│   ├── model.ts         # ビジネスモデル型
│   └── store.ts         # Store 型
├── utils/               # ユーティリティ関数
│   ├── format.ts
│   ├── validate.ts
│   └── storage.ts
├── views/               # ページ
│   ├── dashboard/
│   ├── user/
│   └── order/
└── main.ts
```

## APIサービス層の設計

```typescript
// services/http.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const http = axios.create({
  baseURL: process.env.VUE_APP_API_BASE,
  timeout: 10000,
});

// リクエストインターセプター：token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// レスポンスインターセプター：統一エラー処理
http.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, data, message } = response.data;
    if (code === 0) return data;
    // ビジネスエラー
    return Promise.reject(new Error(message || '请求失败'));
  },
  error => {
    if (error.response?.status === 401) {
      // token の期限切れ、ログインページにリダイレクト
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
  // ユーザーリストを取得
  getList(params: UserQuery): Promise<PaginatedResult<User>> {
    return http.get('/users', { params });
  },

  // ユーザー詳細を取得
  getById(id: number): Promise<User> {
    return http.get(`/users/${id}`);
  },

  // ユーザーを作成
  create(data: Partial<User>): Promise<User> {
    return http.post('/users', data);
  },

  // ユーザーを更新
  update(id: number, data: Partial<User>): Promise<User> {
    return http.put(`/users/${id}`, data);
  },

  // ユーザーを削除
  delete(id: number): Promise<void> {
    return http.delete(`/users/${id}`);
  },
};
```

## 状態管理戦略

```typescript
// 何でもかんでも Vuex/Pinia に入れる必要はない
// 状態の階層化：

// 1. コンポーネント内の状態：useState / ref / reactive
//    コンポーネント内でのみ使用し、共有は不要
//    例：フォーム入力、モーダルの開閉

// 2. グローバルなビジネス状態：Pinia / Vuex
//    複数のコンポーネント/ページで共有
//    例：ユーザー情報、権限、グローバル設定

// 3. サーバー状態：キャッシュ + リクエスト
//    API から取得するデータ
//    例：リストデータ、詳細データ

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

## 権限設計

```typescript
// utils/permission.ts
import { useAuthStore } from '@/store/modules/auth';

// ディレクティブ方式
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

// コンポーネント方式
// <template>
//   <permission :required="['user:create']">
//     <button>ユーザーを追加</button>
//   </permission>
// </template>
```

## ルーティング設計

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

## エラーバウンダリの処理

```typescript
// utils/error-handler.ts
export function setupErrorHandler(app) {
  // Vue グローバルエラーハンドリング
  app.config.errorHandler = (err, vm, info) => {
    console.error('Vue 错误:', err);
    // 監視プラットフォームに報告
    reportError({
      type: 'vue-error',
      error: err.message,
      stack: err.stack,
      component: vm?.$options?.name,
      info,
    });
  };

  // JS グローバルエラー
  window.addEventListener('error', (event) => {
    reportError({
      type: 'js-error',
      error: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  // キャッチされなかった Promise エラー
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'promise-rejection',
      error: event.reason?.message || String(event.reason),
    });
  });
}
```

## まとめ

- アーキテクチャの核心は、コード構造を明確にし、チームのコラボレーションを効率的にすることです
- 階層設計：コンポーネント層、ビジネス層、サービス層、基盤層
- API サービス層でリクエストを一元管理し、型定義でインターフェース契約を保証
- 状態管理はスコープに応じて階層化し、すべての状態をグローバルに管理する必要はありません
- 権限、ルーティング、エラー処理はエンタープライズアプリケーションの基盤であり、優先的に設計する
