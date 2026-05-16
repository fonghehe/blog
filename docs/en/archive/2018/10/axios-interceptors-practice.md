---
title: "Axios Interceptor Encapsulation in Practice"
date: 2018-10-27 14:46:20
tags:
  - Frontend
readingTime: 2
description: "Every project uses axios, yet many developers still scatter requests across individual components. Centralizing interceptors means authentication, error handlin"
---

Every project uses axios, yet many developers still scatter requests across individual components. Centralizing interceptors means authentication, error handling, and loading-state management are written only once.

## Basic Encapsulation

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

// ============ Request Interceptor ============
service.interceptors.request.use(
  (config) => {
    // 1. Attach token
    const token = store.getters.token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. Prevent caching (add timestamp for GET requests)
    if (config.method === "get") {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ============ Response Interceptor ============
service.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;

    // Business success
    if (code === 0 || code === 200) {
      return data;
    }

    // Business error
    Message.error(message || "Operation failed");
    return Promise.reject(new Error(message || "Operation failed"));
  },
  (error) => {
    if (!error.response) {
      // Network error or timeout
      Message.error("Network error, please check your connection");
      return Promise.reject(error);
    }

    const { status } = error.response;

    switch (status) {
      case 401:
        // Token expired — clear login state and redirect to login page
        store.dispatch("user/logout");
        router.push("/login");
        Message.error("Session expired, please log in again");
        break;
      case 403:
        Message.error("You do not have permission to perform this action");
        break;
      case 404:
        Message.error("The requested resource was not found");
        break;
      case 500:
        Message.error("Server error, please try again later");
        break;
      default:
        Message.error(`Request failed (${status})`);
    }

    return Promise.reject(error);
  },
);

export default service;
```

## API Module Based on the Encapsulation

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
// Usage in a component
import { userApi } from "@/api/user";

export default {
  async created() {
    this.loading = true;
    try {
      this.userList = await userApi.getList({ page: 1, pageSize: 20 });
    } catch (e) {
      // Interceptor already called Message.error; perform any additional recovery here
    } finally {
      this.loading = false;
    }
  },
};
```

## Request Cancellation (Debounce)

```javascript
// Cancel pending requests when the component is destroyed
export default {
  data() {
    return {
      cancelSource: null,
    };
  },
  methods: {
    async fetchData() {
      // Cancel the previous request
      if (this.cancelSource) {
        this.cancelSource.cancel("Replaced by new request");
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
    // Cancel any in-flight requests when the component is destroyed
    if (this.cancelSource) {
      this.cancelSource.cancel("Component destroyed");
    }
  },
};
```

## Global Loading Control

```javascript
let requestCount = 0;

function showLoading() {
  if (requestCount === 0) {
    // Show global loading indicator
  }
  requestCount++;
}

function hideLoading() {
  requestCount--;
  if (requestCount === 0) {
    // Hide global loading indicator
  }
}

// In the request interceptor
service.interceptors.request.use((config) => {
  if (!config.silent) {
    // Support silent requests that skip the loading indicator
    showLoading();
  }
  return config;
});

// In the response interceptor (hide on both success and failure)
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

## Summary

- Centralize authentication, error handling, and loading state in interceptors — write once, applied everywhere
- Organize API calls into modules by domain (user, order, etc.)
- Cancel pending requests when components are destroyed to avoid memory leaks and stale updates
- Use a `silent` flag to opt individual requests out of the global loading indicator
