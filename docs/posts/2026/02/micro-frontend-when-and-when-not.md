---
title: "微前端的终点：什么时候该拆，什么时候不该拆"
date: 2026-02-12 12:26:03
tags:
  - 微前端
readingTime: 2
description: "这两年帮好几个团队做过微前端的评估，有上马的，有叫停的。想写一篇清醒的文章。"
wordCount: 395
---

这两年帮好几个团队做过微前端的评估，有上马的，有叫停的。想写一篇清醒的文章。

## 微前端是什么

简单说：把一个大型前端应用拆分成多个可以**独立开发、独立部署**的小应用，在运行时组合成一个整体。

```
传统单体前端：
  一个 repo → 一次构建 → 一次部署

微前端：
  多个 repo → 各自构建 → 各自部署 → 运行时组合
```

## 微前端适合的场景

**场景一：多团队协作，发布冲突**

```
团队 A 负责订单系统，团队 B 负责库存系统
两个团队都在同一个 repo 里改代码
发布窗口冲突，互相 block
→ 拆分成微前端，各自独立发布
```

**场景二：遗留系统渐进迁移**

```
老系统是 jQuery，新系统是 React
不能一次性重写（太大，太有风险）
→ 用微前端在新入口用 React，老功能用 jQuery
逐步替换
```

**场景三：技术栈多元化（有时）**

```
不同团队有不同技术偏好
→ 这个理由很危险，容易导致技术债
只有当不同场景的技术需求确实不同时才成立
```

## 微前端不适合的场景

**团队只有 1-3 人**

微前端引入的工程复杂度（路由协同、状态共享、构建配置）远超收益。

**产品还在早期，需求变化快**

拆分了边界，需求变化时跨应用改动很痛苦。等业务稳定了再考虑。

**"别人在用，我们也要用"**

看到 qiankun、single-spa、Module Federation 就想上。没想清楚解决什么问题。

## 微前端的真实代价

```
1. 样式隔离：各应用样式不互相污染，需要 CSS scope 策略
2. 状态共享：用户登录信息、主题等需要跨应用共享
3. 路由协同：主应用路由 + 子应用路由如何配合
4. 构建复杂度：每个应用需要单独的 CI/CD pipeline
5. 联调困难：本地同时跑 N 个应用才能调试
6. 性能：重复加载相同依赖（React 可能被加载多次）
```

**共享依赖问题的解决成本**往往超出预期。

## Module Federation 实践

如果确定要用微前端，2025 年我会推荐 Webpack 5 Module Federation 或 Vite 的 federation 插件：

```javascript
// host/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "host",
      remotes: {
        // 运行时加载远程模块
        orderApp: "http://order.example.com/assets/remoteEntry.js",
        inventoryApp: "http://inventory.example.com/assets/remoteEntry.js",
      },
      shared: ["react", "react-dom"], // 共享依赖，避免重复加载
    }),
  ],
};
```

```javascript
// order-app/vite.config.ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "orderApp",
      filename: "remoteEntry.js",
      exposes: {
        "./OrderList": "./src/components/OrderList.tsx",
        "./OrderDetail": "./src/components/OrderDetail.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
};
```

```tsx
// host 里使用远程组件
import React, { lazy, Suspense } from "react";
const OrderList = lazy(() => import("orderApp/OrderList"));

function App() {
  return (
    <Suspense fallback={<div>加载订单模块...</div>}>
      <OrderList />
    </Suspense>
  );
}
```

## 我的决策树

```
有没有独立部署需求？
  ├── 没有 → 不需要微前端
  └── 有 → 团队规模多大？
            ├── < 5人 → 单体 + Nx monorepo 可能更好
            └── ≥ 5人，多个独立团队 → 继续评估
                                        ↓
                               业务边界是否清晰？
                               ├── 不清晰 → 先理清业务，再拆技术
                               └── 清晰 → 可以考虑微前端
                                            ↓
                                  拆分方案是否被详细评估过？
                                  (路由、状态、样式、CI/CD 成本)
                                  ├── 没有 → 先做评估
                                  └── 有且可接受 → 上
```

## 小结

- 微前端不是银弹，它是用工程复杂度换部署独立性
- 适合：多团队协作、遗留迁移；不适合：小团队、早期产品
- 上微前端前要想清楚样式隔离、状态共享、路由协同、CI/CD 成本
- Module Federation 是目前最成熟的方案
- 业务边界清晰之前，先不要拆
