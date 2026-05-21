---
title: "Axios 最佳實踐：攔截器與統一錯誤處理"
date: 2018-03-06 11:23:25
tags:
  - 前端
readingTime: 2
description: "Axios 是目前最主流的 HTTP 客户端，但很多項目只是簡單調用，沒有做統一封裝，導致請求邏輯散落各處。這篇文章整理一下完整的封裝方案。"
wordCount: 288
---

Axios 是目前最主流的 HTTP 客户端，但很多項目只是簡單調用，沒有做統一封裝，導致請求邏輯散落各處。這篇文章整理一下完整的封裝方案。

## 為什麼需要封裝

直接用 axios 的問題：

- baseURL、token、超時等配置重複寫
- 錯誤處理邏輯散落在每個請求裏
- Loading 狀態、消息提示分散
- 難以統一替換底層庫

## 創建實例

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

## 請求攔截器

在請求發送前統一處理：

```javascript
service.interceptors.request.use(
  (config) => {
    // 統一添加 token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 可以在這裏顯示全局 Loading
    // store.commit('SET_LOADING', true)

    return config;
  },
  (error) => {
    console.error("請求錯誤:", error);
    return Promise.reject(error);
  },
);
```

## 響應攔截器

統一處理響應和錯誤：

```javascript
service.interceptors.response.use(
  (response) => {
    // store.commit('SET_LOADING', false)

    const { code, data, message } = response.data;

    // 假設業務約定 code=0 是成功
    if (code === 0) {
      return data;
    }

    // 業務錯誤（HTTP 狀態碼是 200，但業務失敗）
    // 比如 token 過期，code=401
    if (code === 401) {
      store.dispatch("user/logout");
      router.push("/login");
      return Promise.reject(new Error(message));
    }

    // 其他業務錯誤
    ElMessage.error(message || "請求失敗");
    return Promise.reject(new Error(message));
  },
  (error) => {
    // store.commit('SET_LOADING', false)

    // HTTP 錯誤
    const status = error.response?.status;
    const messageMap = {
      400: "請求參數錯誤",
      401: "未授權，請重新登錄",
      403: "沒有權限",
      404: "請求地址不存在",
      500: "服務器內部錯誤",
      502: "網關錯誤",
      503: "服務不可用",
    };

    const msg = messageMap[status] || error.message || "網絡錯誤";
    ElMessage.error(msg);

    if (status === 401) {
      store.dispatch("user/logout");
      router.push("/login");
    }

    return Promise.reject(error);
  },
);
```

## 封裝請求方法

```javascript
// 統一導出，隱藏 axios 細節
export const get = (url, params) => service.get(url, { params });
export const post = (url, data) => service.post(url, data);
export const put = (url, data) => service.put(url, data);
export const del = (url) => service.delete(url);

export default service;
```

## API 模塊化

每個業務模塊有自己的 API 文件：

```javascript
// src/api/user.js
import { get, post } from "@/utils/request";

export const login = (data) => post("/auth/login", data);
export const getProfile = () => get("/user/profile");
export const updateProfile = (data) => put("/user/profile", data);
```

```javascript
// 使用
import { login, getProfile } from "@/api/user";

async function handleLogin(form) {
  try {
    const { token } = await login(form);
    localStorage.setItem("token", token);
    const profile = await getProfile();
    this.user = profile;
  } catch (error) {
    // 全局錯誤已經在攔截器處理，這裏只處理特殊邏輯
    console.error(error);
  }
}
```

## 請求取消

長列表篩選、快速切換 Tab 時，需要取消上一次未完成的請求：

```javascript
import axios from "axios";

let cancelToken = null;

async function searchUsers(keyword) {
  // 取消上一次請求
  if (cancelToken) {
    cancelToken.cancel("操作被取消");
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
      console.log("請求已取消:", error.message);
      return null;
    }
    throw error;
  }
}
```

## 重試機制

網絡不穩定時，自動重試：

```javascript
import axiosRetry from "axios-retry";

axiosRetry(service, {
  retries: 3, // 最多重試 3 次
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s
  retryCondition: (error) => {
    // 只重試網絡錯誤和 5xx 錯誤
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});
```

## 小結

好的 Axios 封裝能讓業務代碼專注在業務邏輯，不需要關心：

- Token 怎麼傳
- 錯誤怎麼提示
- Token 過期怎麼處理
- 網絡超時怎麼處理

所有這些橫切關注點都在攔截器裏統一處理。
