---
title: "前端工程化小结：2018年我学到了什么"
date: 2018-11-29 15:54:00
tags:
  - 前端
readingTime: 2
description: "做前端整整两年了，今年算是真正进入\"工程化\"的视野。借这篇文章梳理一下，也给自己一个年底回顾的锚点。"
wordCount: 495
---

做前端整整两年了，今年算是真正进入"工程化"的视野。借这篇文章梳理一下，也给自己一个年底回顾的锚点。

## 从"能跑"到"工程化"的转变

刚入行的时候，能让页面跑起来就行。今年开始意识到，做产品需要的不只是能跑：

```
以前关心：这个功能能不能做
现在关心：这个功能好不好维护、好不好测试、好不好协作
```

具体体现在：

**代码组织**：从把所有逻辑堆在组件里，到按关注点分离（API 层、状态管理、工具函数）

**构建工具**：从"项目里有 webpack 配置，但我看不懂"，到能根据需要配置 Tree Shaking、代码分割、环境变量

**代码质量**：引入了 ESLint + Prettier，现在代码风格统一了；开始写单元测试，至少核心逻辑有测试覆盖

## 今年收获最大的几个知识点

### 1. Vue 响应式原理

知道 `Object.defineProperty` 是怎么工作的之后，很多"奇怪的现象"都有了解释：

```javascript
// 为什么这样不响应？
this.obj.newKey = "value"; // ❌

// 为什么这样可以？
this.$set(this.obj, "newKey", "value"); // ✅
Vue.set(this.obj, "newKey", "value"); // ✅
```

### 2. 异步 JavaScript

```javascript
// 回调 → Promise → async/await 的演进
// 现在理解了为什么 async/await 是生成器+Promise 的语法糖
// 也知道了 Promise.all/race/allSettled 的区别

// 这让我在处理并发请求时有了更多工具
const [users, orders] = await Promise.all([api.getUsers(), api.getOrders()]);
```

### 3. 性能优化

```
Lighthouse 成了日常工具
学会看 Chrome DevTools 的 Performance 面板
理解了 CRP（关键渲染路径）
用 transform/opacity 做动画代替 left/top
```

### 4. TypeScript

```typescript
// 从"不知道有什么用"到"真香"
// 最大的收获不是类型安全本身，而是 IDE 的智能提示
// 重构的时候，TS 的类型错误帮我找到了很多漏改的地方
```

## 还没掌握好的

坦白说，有些东西还是处于"知道但不熟"的阶段：

- **测试**：写了一些单元测试，但集成测试、E2E 测试没有实践
- **CI/CD**：项目里有 Jenkins，但我不太懂配置，出问题了还是找运维
- **性能监控**：理论上懂，但线上监控系统还没搭起来
- **Nginx 配置**：能改，但不能从头写

## 2019 年想做的

React：现在团队主要用 Vue，但 React 的生态很强，React Hooks 的提案很有趣

TypeScript 进阶：现在只会基础用法，高级类型（条件类型、映射类型）想深入学

Node.js：写一个完整的 BFF（Backend for Frontend）层，不只是写脚本

## 小结

2018 年是从"熟练工"到"工程师"转变的一年。技术不只是会用，还要理解原理，还要懂得如何在团队中协作。

希望 2019 年写的代码质量更上一层楼。
