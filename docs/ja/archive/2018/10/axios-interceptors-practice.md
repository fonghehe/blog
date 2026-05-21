---
title: "axios インターセプターのカプセル化実践"
date: 2018-10-27 14:46:20
tags:
  - フロントエンド
readingTime: 2
description: "どのプロジェクトでも axios を使っていますが、リクエストを各コンポーネントに分散させている人は多いです。インターセプターを統一してカプセル化すれば、認証・エラーハンドリング・ローディング状態管理を一度だけ書けば済みます。"
wordCount: 293
---

どのプロジェクトでも axios を使っていますが、リクエストを各コンポーネントに分散させている人は多いです。インターセプターを統一してカプセル化すれば、認証・エラーハンドリング・ローディング状態管理を一度だけ書けば済みます。

## 基本カプセル化

```javascript
// src/utils/request.js
import axios from "axios";
import store from "@/store";
import router from "@/router";
import { Message } from "element-ui";

const service = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 15000,
});

// ============ リクエストインターセプター ============
service.interceptors.request.use(
  (config) => {
    // 1. トークンを付与
    const token = store.getters.token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. キャッシュ防止（GETリクエストにタイムスタンプを追加）
    if (config.method === "get") {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ============ レスポンスインターセプター ============
service.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;

    // ビジネスロジック成功
    if (code === 0 || code === 200) {
      return data;
    }

    // ビジネスロジックエラー
    Message.error(message || "操作に失敗しました");
    return Promise.reject(new Error(message || "操作に失敗しました"));
  },
  (error) => {
    if (!error.response) {
      // ネットワークエラーまたはタイムアウト
      Message.error("ネットワーク異常です。接続を確認してください");
      return Promise.reject(error);
    }

    const { status } = error.response;

    switch (status) {
      case 401:
        // トークン期限切れ — ログイン状態をクリアしてログインページへ
        store.dispatch("user/logout");
        router.push("/login");
        Message.error("セッションが期限切れです。再度ログインしてください");
        break;
      case 403:
        Message.error("この操作を実行する権限がありません");
        break;
      case 404:
        Message.error("要求されたリソースが見つかりません");
        break;
      case 500:
        Message.error(
          "サーバーエラーが発生しました。しばらくしてから再試行してください",
        );
        break;
      default:
        Message.error(`リクエスト失敗 (${status})`);
    }

    return Promise.reject(error);
  },
);

export default service;
```

## カプセル化に基づく API モジュール

```javascript
// src/api/user.js
import request from "@/utils/request";

export const userApi = {
  login: (data) => request.post("/auth/login", data),

  getUserInfo: () => request.get("/user/profile"),

  updateProfile: (data) => request.put("/user/profile", data),

  getList: (params) => request.get("/users", { params }),

  delete: (id) => request.delete(`/users/${id}`),
};
```

```javascript
// コンポーネントでの使用
import { userApi } from "@/api/user";

export default {
  async created() {
    this.loading = true;
    try {
      this.userList = await userApi.getList({ page: 1, pageSize: 20 });
    } catch (e) {
      // インターセプターが Message.error を呼び出し済み。ここでは追加の復旧処理を行う
    } finally {
      this.loading = false;
    }
  },
};
```

## リクエストキャンセル（デバウンス）

```javascript
// コンポーネント破棄時に未完了のリクエストをキャンセル
export default {
  data() {
    return {
      cancelSource: null,
    };
  },
  methods: {
    async fetchData() {
      // 前のリクエストをキャンセル
      if (this.cancelSource) {
        this.cancelSource.cancel("新しいリクエストに置き換え");
      }
      this.cancelSource = axios.CancelToken.source();

      try {
        const data = await userApi.getList({
          ...this.params,
          cancelToken: this.cancelSource.token,
        });
        this.list = data;
      } catch (e) {
        if (!axios.isCancel(e)) {
          console.error(e);
        }
      }
    },
  },
  beforeDestroy() {
    // コンポーネント破棄時に未完了のリクエストをキャンセル
    if (this.cancelSource) {
      this.cancelSource.cancel("コンポーネント破棄");
    }
  },
};
```

## グローバルローディング制御

```javascript
let requestCount = 0;

function showLoading() {
  if (requestCount === 0) {
    // グローバルローディングを表示
  }
  requestCount++;
}

function hideLoading() {
  requestCount--;
  if (requestCount === 0) {
    // グローバルローディングを非表示
  }
}

// リクエストインターセプター内
service.interceptors.request.use((config) => {
  if (!config.silent) {
    // silentフラグを持つリクエストはローディングをスキップ
    showLoading();
  }
  return config;
});

// レスポンスインターセプター内（成功・失敗ともに非表示）
service.interceptors.response.use(
  (response) => {
    hideLoading();
    // ...
  },
  (error) => {
    hideLoading();
    // ...
  },
);
```

## まとめ

- 認証・エラーハンドリング・ローディング状態はインターセプターに集約し、一度だけ書く
- API 呼び出しをドメインごとにモジュール化する（user、order など）
- コンポーネント破棄時に未完了のリクエストをキャンセルしてメモリリークを防ぐ
- `silent` フラグで特定のリクエストをグローバルローディングから除外できる
