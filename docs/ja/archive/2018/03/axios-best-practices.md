---
title: "Axios ベストプラクティス：インターセプターと統合エラー処理"
date: 2018-03-06 11:23:25
tags:
  - フロントエンド
readingTime: 3
description: "Axios は最も主流な HTTP クライアントですが、多くのプロジェクトでは単純に直接呼び出すだけで統一したラッパーを作らず、リクエストロジックが各所に散らばっています。この記事では完全なカプセル化ソリューションを紹介します。"
wordCount: 533
---

Axios は最も主流な HTTP クライアントですが、多くのプロジェクトでは単純に直接呼び出すだけで統一したラッパーを作らず、リクエストロジックが各所に散らばっています。この記事では完全なカプセル化ソリューションを紹介します。

## なぜラップが必要か

Axios を直接使う場合の問題：

- baseURL、token、タイムアウトなどの設定があちこちに重複する
- エラー処理ロジックが各リクエストに散らばる
- ローディング状態やメッセージ表示が分散する
- 下層ライブラリの入れ替えが困難

## インスタンスの作成

```javascript
// src/utils/request.js
import axios from "axios";

const service = axios.create({
  baseURL: process.env.VUE_APP_API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
```

## リクエストインターセプター

すべてのリクエスト前に共通処理を行います：

```javascript
service.interceptors.request.use(
  (config) => {
    // token を一括で付与
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // グローバルローディングをここで表示できる
    // store.commit('SET_LOADING', true)

    return config;
  },
  (error) => {
    console.error("リクエストエラー:", error);
    return Promise.reject(error);
  },
);
```

## レスポンスインターセプター

レスポンスとエラーを一括処理します：

```javascript
service.interceptors.response.use(
  (response) => {
    // store.commit('SET_LOADING', false)

    const { code, data, message } = response.data;

    // ビジネス規約として code=0 を成功とする
    if (code === 0) {
      return data;
    }

    // ビジネスエラー（HTTP ステータスは 200 だがビジネスが失敗）
    // 例：token 期限切れ、code=401
    if (code === 401) {
      store.dispatch("user/logout");
      router.push("/login");
      return Promise.reject(new Error(message));
    }

    // その他のビジネスエラー
    ElMessage.error(message || "リクエストに失敗しました");
    return Promise.reject(new Error(message));
  },
  (error) => {
    // store.commit('SET_LOADING', false)

    // HTTP エラー
    const status = error.response?.status;
    const messageMap = {
      400: "リクエストパラメータエラー",
      401: "認証されていません。再度ログインしてください",
      403: "権限がありません",
      404: "リクエスト先が見つかりません",
      500: "サーバー内部エラー",
      502: "ゲートウェイエラー",
      503: "サービス利用不可",
    };

    const msg = messageMap[status] || error.message || "ネットワークエラー";
    ElMessage.error(msg);

    if (status === 401) {
      store.dispatch("user/logout");
      router.push("/login");
    }

    return Promise.reject(error);
  },
);
```

## リクエストメソッドのラップ

```javascript
// 統合エクスポート、Axios の詳細を隠す
export const get = (url, params) => service.get(url, { params });
export const post = (url, data) => service.post(url, data);
export const put = (url, data) => service.put(url, data);
export const del = (url) => service.delete(url);

export default service;
```

## API のモジュール化

各ビジネスモジュールが独自の API ファイルを持ちます：

```javascript
// src/api/user.js
import { get, post } from "@/utils/request";

export const login = (data) => post("/auth/login", data);
export const getProfile = () => get("/user/profile");
export const updateProfile = (data) => put("/user/profile", data);
```

```javascript
// 使用例
import { login, getProfile } from "@/api/user";

async function handleLogin(form) {
  try {
    const { token } = await login(form);
    localStorage.setItem("token", token);
    const profile = await getProfile();
    this.user = profile;
  } catch (error) {
    // グローバルエラーはインターセプターで処理済み
    // ここでは特殊なロジックのみ処理する
    console.error(error);
  }
}
```

## リクエストのキャンセル

長いリストのフィルタリングやタブの素早い切り替え時に、前の未完了リクエストをキャンセルします：

```javascript
import axios from "axios";

let cancelToken = null;

async function searchUsers(keyword) {
  // 前のリクエストをキャンセル
  if (cancelToken) {
    cancelToken.cancel("操作がキャンセルされました");
  }

  cancelToken = axios.CancelToken.source();

  try {
    const result = await service.get("/users", {
      params: { keyword },
      cancelToken: cancelToken.token,
    });
    return result;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("リクエストがキャンセルされました:", error.message);
      return null;
    }
    throw error;
  }
}
```

## リトライ機構

ネットワークが不安定な場合に自動リトライします：

```javascript
import axiosRetry from "axios-retry";

axiosRetry(service, {
  retries: 3, // 最大 3 回リトライ
  retryDelay: (retryCount) => retryCount * 1000, // 1秒、2秒、3秒
  retryCondition: (error) => {
    // ネットワークエラーと 5xx エラーのみリトライ
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});
```

## まとめ

適切な Axios のラップにより、ビジネスコードはビジネスロジックに集中でき、以下を気にする必要がなくなります：

- token の渡し方
- エラーメッセージの表示方法
- token 期限切れの処理
- ネットワークタイムアウトの処理

これらの横断的関心事はすべてインターセプターで一括処理されます。
