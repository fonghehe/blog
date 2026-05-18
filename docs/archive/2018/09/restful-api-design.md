---
title: "RESTful API 设计规范"
date: 2018-09-10 09:32:45
tags:
  - 后端
readingTime: 1
description: "前后端对接时，API 设计标准不统一容易产生很多摩擦。整理一下 RESTful 的核心规范，方便和后端对齐。"
---

前后端对接时，API 设计标准不统一容易产生很多摩擦。整理一下 RESTful 的核心规范，方便和后端对齐。

## REST 的核心思想

REST 把 Web 资源抽象成 URI，用 HTTP 方法表示操作：

```
资源：/users, /products/123, /orders
操作：
  GET     获取资源（不修改数据）
  POST    创建资源
  PUT     全量更新资源
  PATCH   部分更新资源
  DELETE  删除资源
```

## URI 设计

```
✅ 好的设计（名词复数，层级表示从属关系）：
GET    /users                   获取用户列表
GET    /users/123               获取用户 123
POST   /users                   创建用户
PUT    /users/123               更新用户 123（全量）
PATCH  /users/123               更新用户 123（部分）
DELETE /users/123               删除用户 123
GET    /users/123/orders        用户 123 的订单列表
GET    /users/123/orders/456    用户 123 的订单 456

❌ 不好的设计（动词、不统一）：
GET  /getUser
POST /createUser
GET  /user/delete?id=123
POST /updateUserInfo
```

## 状态码使用

```
2xx 成功：
  200 OK           请求成功（GET、PUT、PATCH、DELETE）
  201 Created      创建成功（POST）
  204 No Content   成功但无返回内容（DELETE）

4xx 客户端错误：
  400 Bad Request        请求参数错误
  401 Unauthorized       未登录（需要认证）
  403 Forbidden          已登录但无权限
  404 Not Found          资源不存在
  409 Conflict           冲突（如用户名已存在）
  422 Unprocessable      参数验证失败

5xx 服务端错误：
  500 Internal Server Error
```

## 响应格式

```json
// 成功响应（列表）
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

// 成功响应（单个资源）
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123,
    "name": "张三",
    "email": "zhangsan@example.com"
  }
}

// 错误响应
{
  "code": 40001,
  "message": "用户名已存在",
  "data": null
}
```

## 分页和过滤

```
GET /users?page=1&pageSize=20              分页
GET /users?status=active                   过滤
GET /users?sort=createdAt&order=desc       排序
GET /users?fields=id,name,email            字段选择
GET /users?keyword=张&status=active        组合
```

## 前端 API 封装

```javascript
// api/users.js
import request from "@/utils/request";

export const usersApi = {
  // 获取列表
  getList(params) {
    return request.get("/users", { params });
  },
  // 获取单个
  getById(id) {
    return request.get(`/users/${id}`);
  },
  // 创建
  create(data) {
    return request.post("/users", data);
  },
  // 更新
  update(id, data) {
    return request.patch(`/users/${id}`, data);
  },
  // 删除
  remove(id) {
    return request.delete(`/users/${id}`);
  },
};
```

## 小结

- URI 用名词复数，层级表示从属，不要用动词
- HTTP 方法表示操作：GET/POST/PUT/PATCH/DELETE
- 状态码语义化：4xx 客户端错误，5xx 服务端错误
- 响应统一格式：code、message、data
- 分页、过滤用查询参数