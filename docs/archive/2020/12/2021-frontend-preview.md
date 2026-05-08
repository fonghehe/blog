---
title: "2021 前端技术展望：框架成熟期与工程化深水区"
date: 2020-12-31 09:35:56
tags:
  - 前端
---

2020 年是前端历史上变化最密集的年份之一：Vue 3 正式发布、React 17 升级铺路、Angular 保持季度发版节奏、Vite 颠覆开发体验、webpack 5 发布 Module Federation。站在 2020 年末，来聊聊 2021 年值得关注的方向。

## 框架进入稳定成熟期

### Vue 3 生态补全

Vue 3 于 2020 年 9 月发布，但生态还不完整。2021 年预期：

- Vue Router 4 和 Pinia（Vuex 5）趋于稳定
- Nuxt 3（基于 Vue 3）发布
- UI 库（Element Plus、Ant Design Vue 3.x）相继完善

### React Server Components

React 团队在 2020 年底预览了 Server Components——在服务端渲染组件，零客户端 JS。这可能是 React 近年来最大的架构变化：

```jsx
// Server Component（文件名 .server.js）
// 直接访问数据库，代码不发送到浏览器
import db from "./db";

async function Notes() {
  const notes = await db.query("SELECT * FROM notes");
  return <NoteList notes={notes} />;
}
```

### Angular 12 预告

Angular 12 预计 2021 年 Q2 发布，将正式删除 View Engine，Ivy 成为唯一渲染引擎。Webpack 5 也会从实验性转为默认。

## 工程化进入深水区

### 微前端从概念落地

Module Federation（webpack 5）让微前端从"需要框架支持"变成了"内置于构建工具"：

```javascript
// 2021 年微前端的标准方案将更清晰
// qiankun（基于 single-spa）vs Module Federation 的边界会越来越明确
```

### Monorepo 工具成熟

Nx、Turborepo（Vercel，2020 年底发布）的出现让 Monorepo 管理更简单。2021 年大型团队采用 Monorepo 的比例将显著上升。

### 构建速度军备竞赛

esbuild、SWC（Rust 写的 JS 编译器，Next.js 12 将采用）的出现预示着：**用系统语言（Go/Rust）重写 JS 工具链**是 2021 年的主旋律。

## TypeScript 全面渗透

2020 年 State of JS 调查：TypeScript 满意度 93%，使用率首次超过纯 JavaScript。2021 年预期：

- 大型团队新项目 100% TypeScript
- TypeScript 4.x 持续改进类型推断和性能
- `ts-node` 与 Deno 让服务端 TS 更主流

## 性能指标标准化

Google 的 Core Web Vitals（LCP、FID、CLS）将在 2021 年 5 月正式纳入 Google 搜索排名算法。这意味着性能优化从"加分项"变成了"必选项"：

| 指标 | 含义         | Good 标准 |
| ---- | ------------ | --------- |
| LCP  | 最大内容绘制 | ≤ 2.5s    |
| FID  | 首次输入延迟 | ≤ 100ms   |
| CLS  | 累计布局偏移 | ≤ 0.1     |

## 个人学习路线建议

**深耕方向**（选一个）：

- Vue 3 + Composition API + Pinia（全套 Vue 生态）
- React + React Query + Zustand/Jotai（现代 React 状态管理）
- Angular + RxJS + NgRx（企业级方向）

**横向能力**：

- TypeScript 泛型和高级类型
- webpack 5 / Vite 配置调优
- 性能优化：Core Web Vitals 指标体系

## 总结

2021 年前端的关键词是**成熟与深化**——框架本身不会有颠覆性变化，但工程化、性能、TypeScript 这几个方向会持续深入。与其追新框架，不如把现有技术栈用到极致。
