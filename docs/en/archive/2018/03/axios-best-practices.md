---
title: "Axios Best Practices: Interceptors and Unified Error Handling"
date: 2018-03-06 11:23:25
tags:
  - Frontend
readingTime: 2
description: "Axios is the most mainstream HTTP client, but many projects just call it directly without a unified wrapper, resulting in request logic scattered everywhere. Th"
wordCount: 164
---

Axios is the most mainstream HTTP client, but many projects just call it directly without a unified wrapper, resulting in request logic scattered everywhere. This article presents a complete encapsulation solution.

## Why Wrap Axios

Problems with using Axios directly:

- baseURL, token, timeout and other configs repeated everywhere
- Error handling logic scattered across every request
- Loading state and message prompts spread out
- Hard to swap out the underlying library

## Create an Instance

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

## Request Interceptor

Handle common concerns before every request:

```javascript
service.interceptors.request.use(
  (config) => {
    // Attach token to all requests
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // You could show a global loading spinner here
    // store.commit('SET_LOADING', true)

    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);
```

## Response Interceptor

Handle responses and errors uniformly:

```javascript
service.interceptors.response.use(
  (response) => {
    // store.commit('SET_LOADING', false)

    const { code, data, message } = response.data;

    // Assume business convention: code=0 means success
    if (code === 0) {
      return data;
    }

    // Business error (HTTP status is 200, but business failed)
    // E.g. token expired: code=401
    if (code === 401) {
      store.dispatch("user/logout");
      router.push("/login");
      return Promise.reject(new Error(message));
    }

    // Other business errors
    ElMessage.error(message || "Request failed");
    return Promise.reject(new Error(message));
  },
  (error) => {
    // store.commit('SET_LOADING', false)

    // HTTP errors
    const status = error.response?.status;
    const messageMap = {
      400: "Bad request parameters",
      401: "Unauthorized, please log in again",
      403: "Access denied",
      404: "Resource not found",
      500: "Internal server error",
      502: "Bad gateway",
      503: "Service unavailable",
    };

    const msg = messageMap[status] || error.message || "Network error";
    ElMessage.error(msg);

    if (status === 401) {
      store.dispatch("user/logout");
      router.push("/login");
    }

    return Promise.reject(error);
  },
);
```

## Wrap Request Methods

```javascript
// Export unified methods, hiding Axios details
export const get = (url, params) => service.get(url, { params });
export const post = (url, data) => service.post(url, data);
export const put = (url, data) => service.put(url, data);
export const del = (url) => service.delete(url);

export default service;
```

## Modular API Files

Each business module has its own API file:

```javascript
// src/api/user.js
import { get, post } from "@/utils/request";

export const login = (data) => post("/auth/login", data);
export const getProfile = () => get("/user/profile");
export const updateProfile = (data) => put("/user/profile", data);
```

```javascript
// Usage
import { login, getProfile } from "@/api/user";

async function handleLogin(form) {
  try {
    const { token } = await login(form);
    localStorage.setItem("token", token);
    const profile = await getProfile();
    this.user = profile;
  } catch (error) {
    // Global errors are already handled in the interceptor
    // Only handle special cases here
    console.error(error);
  }
}
```

## Request Cancellation

When filtering long lists or quickly switching tabs, cancel the previous unfinished request:

```javascript
import axios from "axios";

let cancelToken = null;

async function searchUsers(keyword) {
  // Cancel the previous request
  if (cancelToken) {
    cancelToken.cancel("Operation cancelled");
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
      console.log("Request cancelled:", error.message);
      return null;
    }
    throw error;
  }
}
```

## Retry Mechanism

Automatically retry on unstable networks:

```javascript
import axiosRetry from "axios-retry";

axiosRetry(service, {
  retries: 3, // maximum 3 retries
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s
  retryCondition: (error) => {
    // Only retry on network errors and 5xx errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});
```

## Summary

Good Axios encapsulation lets business code focus on business logic without worrying about:

- How to pass tokens
- How to show error messages
- How to handle token expiration
- How to handle network timeouts

All these cross-cutting concerns are handled uniformly in interceptors.
