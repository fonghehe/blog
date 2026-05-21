---
title: "axios 拦截器封装实践"
date: 2018-10-27 14:46:20
tags:
  - 前端
readingTime: 2
description: "每个项目都在用 axios，但很多人还是把请求分散在各个组件里。统一封装拦截器，能让认证、错误处理、loading 状态管理这些事情只写一遍。"
wordCount: 157
---

每个项目都在用 axios，但很多人还是把请求分散在各个组件里。统一封装拦截器，能让认证、错误处理、loading 状态管理这些事情只写一遍。

## 基础封装

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

// ============ 请求拦截器 ============
service.interceptors.request.use(
  (config) => {
    // 1. 带上 token
    const token = store.getters.token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. 防止缓存（GET 请求加时间戳）
    if (config.method === "get") {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ============ 响应拦截器 ============
service.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;

    // 业务成功
    if (code === 0 || code === 200) {
      return data;
    }

    // 业务错误
    Message.error(message || "操作失败");
    return Promise.reject(new Error(message || "操作失败"));
  },
  (error) => {
    if (!error.response) {
      // 网络错误或超时
      Message.error("网络异常，请检查网络连接");
      return Promise.reject(error);
    }

    const { status } = error.response;

    switch (status) {
      case 401:
        // token 过期，清除登录状态，跳转登录页
        store.dispatch("user/logout");
        router.push("/login");
        Message.error("登录已过期，请重新登录");
        break;
      case 403:
        Message.error("没有权限执行此操作");
        break;
      case 404:
        Message.error("请求的资源不存在");
        break;
      case 500:
        Message.error("服务器错误，请稍后重试");
        break;
      default:
        Message.error(`请求失败 (${status})`);
    }

    return Promise.reject(error);
  },
);

export default service;
```

## 基于封装的 API 模块

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
// 组件里使用
import { userApi } from "@/api/user";

export default {
  async created() {
    this.loading = true;
    try {
      this.userList = await userApi.getList({ page: 1, pageSize: 20 });
    } catch (e) {
      // 拦截器已经 Message.error，这里可以做其他恢复操作
    } finally {
      this.loading = false;
    }
  },
};
```

## 请求取消（防抖）

```javascript
// 组件销毁时取消未完成的请求
export default {
  data() {
    return {
      cancelSource: null,
    };
  },
  methods: {
    async fetchData() {
      // 取消上一次请求
      if (this.cancelSource) {
        this.cancelSource.cancel("新请求取代旧请求");
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
    // 组件销毁时取消未完成的请求
    if (this.cancelSource) {
      this.cancelSource.cancel("组件销毁");
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
    // 隐藏全局 loading
  }
}

// 请求拦截器里
service.interceptors.request.use((config) => {
  if (!config.silent) {
    // 支持某些请求静默
    showLoading();
  }
  return config;
});

// 响应拦截器里（成功和失败都要 hide）
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

## 小结

- 请求拦截器：统一加 token、处理 GET 缓存
- 响应拦截器：统一处理业务错误码、HTTP 状态码
- API 模块：按业务拆分，组件里只调接口不处理 HTTP 细节
- 请求取消：列表页快速翻页时避免旧请求覆盖新数据
