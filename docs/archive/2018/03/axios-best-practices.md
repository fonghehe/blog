---
title: "Axios 最佳实践：拦截器与统一错误处理"
date: 2018-03-06 11:23:25
tags:
  - 前端
readingTime: 2
description: "Axios 是目前最主流的 HTTP 客户端，但很多项目只是简单调用，没有做统一封装，导致请求逻辑散落各处。这篇文章整理一下完整的封装方案。"
---

Axios 是目前最主流的 HTTP 客户端，但很多项目只是简单调用，没有做统一封装，导致请求逻辑散落各处。这篇文章整理一下完整的封装方案。

## 为什么需要封装

直接用 axios 的问题：

- baseURL、token、超时等配置重复写
- 错误处理逻辑散落在每个请求里
- Loading 状态、消息提示分散
- 难以统一替换底层库

## 创建实例

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

## 请求拦截器

在请求发送前统一处理：

```javascript
service.interceptors.request.use(
  (config) => {
    // 统一添加 token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 可以在这里显示全局 Loading
    // store.commit('SET_LOADING', true)

    return config;
  },
  (error) => {
    console.error("请求错误:", error);
    return Promise.reject(error);
  },
);
```

## 响应拦截器

统一处理响应和错误：

```javascript
service.interceptors.response.use(
  (response) => {
    // store.commit('SET_LOADING', false)

    const { code, data, message } = response.data;

    // 假设业务约定 code=0 是成功
    if (code === 0) {
      return data;
    }

    // 业务错误（HTTP 状态码是 200，但业务失败）
    // 比如 token 过期，code=401
    if (code === 401) {
      store.dispatch("user/logout");
      router.push("/login");
      return Promise.reject(new Error(message));
    }

    // 其他业务错误
    ElMessage.error(message || "请求失败");
    return Promise.reject(new Error(message));
  },
  (error) => {
    // store.commit('SET_LOADING', false)

    // HTTP 错误
    const status = error.response?.status;
    const messageMap = {
      400: "请求参数错误",
      401: "未授权，请重新登录",
      403: "没有权限",
      404: "请求地址不存在",
      500: "服务器内部错误",
      502: "网关错误",
      503: "服务不可用",
    };

    const msg = messageMap[status] || error.message || "网络错误";
    ElMessage.error(msg);

    if (status === 401) {
      store.dispatch("user/logout");
      router.push("/login");
    }

    return Promise.reject(error);
  },
);
```

## 封装请求方法

```javascript
// 统一导出，隐藏 axios 细节
export const get = (url, params) => service.get(url, { params });
export const post = (url, data) => service.post(url, data);
export const put = (url, data) => service.put(url, data);
export const del = (url) => service.delete(url);

export default service;
```

## API 模块化

每个业务模块有自己的 API 文件：

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
    // 全局错误已经在拦截器处理，这里只处理特殊逻辑
    console.error(error);
  }
}
```

## 请求取消

长列表筛选、快速切换 Tab 时，需要取消上一次未完成的请求：

```javascript
import axios from "axios";

let cancelToken = null;

async function searchUsers(keyword) {
  // 取消上一次请求
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
      console.log("请求已取消:", error.message);
      return null;
    }
    throw error;
  }
}
```

## 重试机制

网络不稳定时，自动重试：

```javascript
import axiosRetry from "axios-retry";

axiosRetry(service, {
  retries: 3, // 最多重试 3 次
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s
  retryCondition: (error) => {
    // 只重试网络错误和 5xx 错误
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});
```

## 小结

好的 Axios 封装能让业务代码专注在业务逻辑，不需要关心：

- Token 怎么传
- 错误怎么提示
- Token 过期怎么处理
- 网络超时怎么处理

所有这些横切关注点都在拦截器里统一处理。
