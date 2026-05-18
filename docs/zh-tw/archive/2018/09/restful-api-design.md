---
title: "RESTful API 設計規範"
date: 2018-09-10 09:32:45
tags:
  - 後端
readingTime: 1
description: "前後端對接時，API 設計標準不統一容易產生很多摩擦。整理一下 RESTful 的核心規範，方便和後端對齊。"
---

前後端對接時，API 設計標準不統一容易產生很多摩擦。整理一下 RESTful 的核心規範，方便和後端對齊。

## REST 的核心思想

REST 把 Web 資源抽象成 URI，用 HTTP 方法表示操作：

```
資源：/users, /products/123, /orders
操作：
  GET     獲取資源（不修改資料）
  POST    建立資源
  PUT     全量更新資源
  PATCH   部分更新資源
  DELETE  刪除資源
```

## URI 設計

```
✅ 好的設計（名詞複數，層級表示從屬關係）：
GET    /users                   獲取使用者列表
GET    /users/123               獲取使用者 123
POST   /users                   建立使用者
PUT    /users/123               更新使用者 123（全量）
PATCH  /users/123               更新使用者 123（部分）
DELETE /users/123               刪除使用者 123
GET    /users/123/orders        使用者 123 的訂單列表
GET    /users/123/orders/456    使用者 123 的訂單 456

❌ 不好的設計（動詞、不統一）：
GET  /getUser
POST /createUser
GET  /user/delete?id=123
POST /updateUserInfo
```

## 狀態碼使用

```
2xx 成功：
  200 OK           請求成功（GET、PUT、PATCH、DELETE）
  201 Created      建立成功（POST）
  204 No Content   成功但無返回內容（DELETE）

4xx 客戶端錯誤：
  400 Bad Request        請求引數錯誤
  401 Unauthorized       未登入（需要認證）
  403 Forbidden          已登入但無許可權
  404 Not Found          資源不存在
  409 Conflict           衝突（如使用者名稱已存在）
  422 Unprocessable      引數驗證失敗

5xx 服務端錯誤：
  500 Internal Server Error
```

## 響應格式

```json
// 成功響應（列表）
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}

// 成功響應（單個資源）
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123,
    "name": "張三",
    "email": "zhangsan@example.com"
  }
}

// 錯誤響應
{
  "code": 40001,
  "message": "使用者名稱已存在",
  "data": null
}
```

## 分頁和過濾

```
GET /users?page=1&pageSize=20              分頁
GET /users?status=active                   過濾
GET /users?sort=createdAt&order=desc       排序
GET /users?fields=id,name,email            欄位選擇
GET /users?keyword=張&status=active        組合
```

## 前端 API 封裝

```javascript
// api/users.js
import request from "@/utils/request";

export const usersApi = {
  // 獲取列表
  getList(params) {
    return request.get("/users", { params });
  },
  // 獲取單個
  getById(id) {
    return request.get(`/users/${id}`);
  },
  // 建立
  create(data) {
    return request.post("/users", data);
  },
  // 更新
  update(id, data) {
    return request.patch(`/users/${id}`, data);
  },
  // 刪除
  remove(id) {
    return request.delete(`/users/${id}`);
  },
};
```

## 小結

- URI 用名詞複數，層級表示從屬，不要用動詞
- HTTP 方法表示操作：GET/POST/PUT/PATCH/DELETE
- 狀態碼語義化：4xx 客戶端錯誤，5xx 服務端錯誤
- 響應統一格式：code、message、data
- 分頁、過濾用查詢引數