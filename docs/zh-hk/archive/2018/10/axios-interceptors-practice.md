---
title: "axios 攔截器封裝實踐"
date: 2018-10-27 14:46:20
tags:
  - 前端
readingTime: 2
description: "每個項目都在用 axios，但很多人還是把請求分散在各個組件裏。統一封裝攔截器，能讓認證、錯誤處理、loading 狀態管理這些事情只寫一遍。"
---

每個項目都在用 axios，但很多人還是把請求分散在各個組件裏。統一封裝攔截器，能讓認證、錯誤處理、loading 狀態管理這些事情只寫一遍。

## 基礎封裝

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

// ============ 請求攔截器 ============
service.interceptors.request.use(
  (config) => {
    // 1. 帶上 token
    const token = store.getters.token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. 防止緩存（GET 請求加時間戳）
    if (config.method === "get") {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ============ 響應攔截器 ============
service.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;

    // 業務成功
    if (code === 0 || code === 200) {
      return data;
    }

    // 業務錯誤
    Message.error(message || "操作失敗");
    return Promise.reject(new Error(message || "操作失敗"));
  },
  (error) => {
    if (!error.response) {
      // 網絡錯誤或超時
      Message.error("網絡異常，請檢查網絡連接");
      return Promise.reject(error);
    }

    const { status } = error.response;

    switch (status) {
      case 401:
        // token 過期，清除登錄狀態，跳轉登錄頁
        store.dispatch("user/logout");
        router.push("/login");
        Message.error("登錄已過期，請重新登錄");
        break;
      case 403:
        Message.error("沒有權限執行此操作");
        break;
      case 404:
        Message.error("請求的資源不存在");
        break;
      case 500:
        Message.error("服務器錯誤，請稍後重試");
        break;
      default:
        Message.error(`請求失敗 (${status})`);
    }

    return Promise.reject(error);
  },
);

export default service;
```

## 基於封裝的 API 模塊

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
// 組件裏使用
import { userApi } from "@/api/user";

export default {
  async created() {
    this.loading = true;
    try {
      this.userList = await userApi.getList({ page: 1, pageSize: 20 });
    } catch (e) {
      // 攔截器已經 Message.error，這裏可以做其他恢復操作
    } finally {
      this.loading = false;
    }
  },
};
```

## 請求取消（防抖）

```javascript
// 組件銷燬時取消未完成的請求
export default {
  data() {
    return {
      cancelSource: null,
    };
  },
  methods: {
    async fetchData() {
      // 取消上一次請求
      if (this.cancelSource) {
        this.cancelSource.cancel("新請求取代舊請求");
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
    // 組件銷燬時取消未完成的請求
    if (this.cancelSource) {
      this.cancelSource.cancel("組件銷燬");
    }
  },
};
```

## 全局 loading 控制

```javascript
let requestCount = 0;

function showLoading() {
  if (requestCount === 0) {
    // 展示全局 loading
  }
  requestCount++;
}

function hideLoading() {
  requestCount--;
  if (requestCount === 0) {
    // 隱藏全局 loading
  }
}

// 請求攔截器裏
service.interceptors.request.use((config) => {
  if (!config.silent) {
    // 支持某些請求靜默
    showLoading();
  }
  return config;
});

// 響應攔截器裏（成功和失敗都要 hide）
service.interceptors.response.use(
  (response) => {
    hideLoading();
    return response;
  },
  (error) => {
    hideLoading();
    return Promise.reject(error);
  },
);
```

## 小結

- 請求攔截器：統一加 token、處理 GET 緩存
- 響應攔截器：統一處理業務錯誤碼、HTTP 狀態碼
- API 模塊：按業務拆分，組件裏只調接口不處理 HTTP 細節
- 請求取消：列表頁快速翻頁時避免舊請求覆蓋新數據
