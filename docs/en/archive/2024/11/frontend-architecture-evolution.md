---
title: "Frontend Architecture Evolution: From Pages to Components to Modules"
date: 2024-11-14 17:08:45
tags:
  - Frontend
readingTime: 2
description: "Seven years in frontend development. I want to trace how our code organization has evolved over the years from an architecture perspective."
wordCount: 297
---

Seven years in frontend development. I want to trace how our code organization has evolved over the years from an architecture perspective.

## 2016-2017: File Organization in the jQuery Era

```
/
├── index.html
├── css/
│   ├── reset.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── vendor/
│   │   └── jquery.min.js
│   ├── utils.js
│   ├── api.js
│   └── page-index.js
└── assets/
```

特点：

- 以文件类型分目录（css/js/images）
- 每个页面一个 JS 文件
- 全局变量污染，依赖关系靠注释声明
- "面向过程"的代码组织

## 2018-2019: The Vue/React Component Era

```
src/
├── components/        ← 通用组件
│   ├── Button.vue
│   ├── Modal.vue
│   └── Table.vue
├── views/             ← 页面级组件
│   ├── Home.vue
│   └── UserProfile.vue
├── store/             ← 全局状态
├── api/               ← 接口请求
├── utils/             ← 工具函数
└── router/            ← 路由配置
```

特点：

- 以功能类型分目录
- 组件复用为中心
- 集中式状态管理（Vuex/Redux）
- 问题：随项目增长，各目录越来越膨胀

## 2020-2022: Feature Modularization

```
src/
├── features/          ← 按功能领域划分
│   ├── auth/
│   │   ├── AuthForm.tsx
│   │   ├── useAuth.ts
│   │   ├── authSlice.ts
│   │   └── authApi.ts
│   ├── products/
│   │   ├── ProductList.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── useProducts.ts
│   │   └── productApi.ts
│   └── cart/
│       ├── Cart.tsx
│       ├── useCart.ts
│       └── cartSlice.ts
├── shared/            ← 跨功能共享
│   ├── components/    ← 真正通用的组件
│   ├── hooks/
│   ├── utils/
│   └── types/
└── app/               ← 应用入口、路由、全局配置
```

特点：

- 按业务领域（domain）组织
- 相关代码放在一起（高内聚）
- 跨领域的才放 shared/
- 扩展性好：加新功能只需加新目录

## 2023-2024: Layered Architecture

Inspired by Feature-Sliced Design (FSD), our current team architecture:

```
src/
├── app/               ← 应用入口
│   ├── providers/
│   ├── router/
│   └── store/
├── pages/             ← 页面（只负责组合）
│   ├── HomePage/
│   └── ProductPage/
├── widgets/           ← 独立的页面区块
│   ├── Header/
│   ├── Sidebar/
│   └── ProductCatalog/
├── features/          ← 用户功能（有交互的）
│   ├── auth/
│   ├── cart/
│   └── search/
├── entities/          ← 业务实体
│   ├── product/
│   ├── user/
│   └── order/
└── shared/            ← 技术基础设施
    ├── ui/            ← 设计系统组件
    ├── api/
    ├── lib/
    └── config/
```

**Dependency Rule (top-to-bottom, no reverse):**

```
app → pages → widgets → features → entities → shared
```

## Dimensions for Evaluating an Architecture

```
1. 可寻路性（Navigability）
   新人能在 5 分钟内找到某个功能的代码吗？

2. 可扩展性（Scalability）
   加一个新功能需要改多少文件？改多少现有代码？

3. 可测试性（Testability）
   各模块能独立测试吗？测试数据怎么 mock？

4. 边界清晰度（Boundary Clarity）
   两个模块能清楚地划分责任吗？
   修改一个模块会意外影响另一个吗？
```

## Recommendations for Teams

Architecture is not an all-at-once thing. For projects of different sizes:

```
小项目（1-3人，<50个组件）
  → 按类型分目录就够了，别过度设计

中型项目（3-8人，50-200个组件）
  → features/ 模块化，shared/ 共享

大型项目（8人+，200+个组件）
  → 分层架构 + 领域模型 + 代码规范
```

## Summary

- 架构演进方向：文件类型分组 → 组件化 → 功能模块 → 分层架构
- 没有"最好"的架构，只有适合当前团队和项目阶段的架构
- 最重要的原则：高内聚（相关代码放一起）、低耦合（模块间依赖少）
- 定期重构比一次到位更实际
