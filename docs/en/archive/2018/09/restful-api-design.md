---
title: "RESTful API Design Guidelines"
date: 2018-09-10 09:32:45
tags:
  - Backend
readingTime: 1
description: "Inconsistent API design standards between frontend and backend create a lot of friction. Here's a summary of core RESTful conventions for aligning with your bac"
---

Inconsistent API design standards between frontend and backend create a lot of friction. Here's a summary of core RESTful conventions for aligning with your backend team.

## Core Idea of REST

REST abstracts web resources as URIs and uses HTTP methods to represent operations:

```
Resources: /users, /products/123, /orders
Operations:
  GET     Retrieve resources (no data modification)
  POST    Create a resource
  PUT     Fully update a resource
  PATCH   Partially update a resource
  DELETE  Delete a resource
```

## URI Design

```
✅ Good design (plural nouns, hierarchy shows ownership):
GET    /users                   Get user list
GET    /users/123               Get user 123
POST   /users                   Create user
PUT    /users/123               Update user 123 (full)
PATCH  /users/123               Update user 123 (partial)
DELETE /users/123               Delete user 123
GET    /users/123/orders        Orders of user 123
GET    /users/123/orders/456    Order 456 of user 123

❌ Bad design (verbs, inconsistent):
GET  /getUser
POST /createUser
GET  /user/delete?id=123
POST /updateUserInfo
```

## HTTP Status Codes

```
2xx Success:
  200 OK           Request succeeded (GET, PUT, PATCH, DELETE)
  201 Created      Resource created (POST)
  204 No Content   Success with no response body (DELETE)

4xx Client errors:
  400 Bad Request        Invalid request parameters
  401 Unauthorized       Not authenticated
  403 Forbidden          Authenticated but lacks permission
  404 Not Found          Resource does not exist
  409 Conflict           Conflict (e.g. username already taken)
  422 Unprocessable      Parameter validation failed

5xx Server errors:
  500 Internal Server Error
```

## Response Format

```json
// Success (list)
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

// Success (single resource)
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 123,
    "name": "Alice",
    "email": "alice@example.com"
  }
}

// Error
{
  "code": 40001,
  "message": "Username already taken",
  "data": null
}
```

## Pagination and Filtering

```
GET /users?page=1&pageSize=20              Pagination
GET /users?status=active                   Filter
GET /users?sort=createdAt&order=desc       Sort
GET /users?fields=id,name,email            Field selection
GET /users?keyword=alice&status=active     Combined
```

## Frontend API Wrapper

```javascript
// api/users.js
import request from "@/utils/request";

export const usersApi = {
  // Get list
  getList(params) {
    return request.get("/users", { params });
  },
  // Get single
  getById(id) {
    return request.get(`/users/${id}`);
  },
  // Create
  create(data) {
    return request.post("/users", data);
  },
  // Update
  update(id, data) {
    return request.patch(`/users/${id}`, data);
  },
  // Delete
  remove(id) {
    return request.delete(`/users/${id}`);
  },
};
```

## Summary

- Use plural nouns in URIs, hierarchy shows ownership, no verbs
- HTTP methods represent operations: GET/POST/PUT/PATCH/DELETE
- Semantic status codes: 4xx client errors, 5xx server errors
- Unified response format: code, message, data
- Use query params for pagination, filtering, and sorting
