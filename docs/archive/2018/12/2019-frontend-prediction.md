---
title: "2019 前端技术趋势预测"
date: 2018-12-22 17:40:50
tags:
  - 前端
readingTime: 2
description: "2018 年即将结束，来预测一下 2019 年的前端走向。"
wordCount: 644
---

2018 年即将结束，来预测一下 2019 年的前端走向。

## React Hooks 正式版

这是 2019 年最确定会发生的事之一。Hooks 在 2018 年 React Conf 亮相，API 基本稳定，2019 年初会正式发布（随 React 16.8）。

预测：

- Hooks 会快速替代 HOC 和 render props 成为主流
- 大量现有库会推出 Hooks 版本（react-query、SWR 等）
- 函数组件成为默认写法，class 组件会慢慢减少

## Vue 3.0 进入实质性开发

2018 年底尤雨溪已经透露了 Vue 3 的方向：

- Composition API（借鉴 React Hooks 的思路）
- 基于 Proxy 的响应式（解决 Vue 2 的已知限制）
- 更好的 TypeScript 支持
- 更小的体积（Tree Shaking 更彻底）

2019 年应该会有 Alpha 版本，但正式版可能要到 2020 年。

## TypeScript 继续普及

2018 年 TypeScript 已经很流行了，2019 年预计：

- 更多开源库提供一等 TypeScript 支持
- 团队越来越难拒绝 TS（入职要求会出现 TS）
- TypeScript 4.x 的高级类型更实用

## 构建工具：竞争加剧

Webpack 4 已经足够快，但还有几个新玩家值得关注：

- **Parcel**：零配置，适合小项目
- **Rollup**：库的打包首选
- **Snowpack（早期雏形）**：基于 ESM 的开发服务器概念

预测 2019 年不会有颠覆性变化，Webpack 仍是主流。

## 微前端从概念到落地

2018 年微前端主要在讨论层面，2019 年会有更多实际落地案例。single-spa 会继续成熟，国内会出现更多中文实践文章。

## 小程序生态继续扩张

微信小程序、支付宝小程序、字节跳动小程序都在发展。跨平台小程序框架（uni-app、Taro）会继续改进。前端要会写小程序越来越重要。

## 渐进式 Web App（PWA）

PWA 在国内的普及比预想慢，主要原因是 iOS Safari 对 Service Worker 的支持不完整（2018 年已改善）。2019 年随着 iOS 12 普及，PWA 可能会有新一轮热潮。

## AI 辅助编程

GitHub Copilot 等工具还没出现，但 2019 年会有更多关于 AI 辅助代码生成的讨论。不过大规模应用可能还要几年。

## 我的个人计划

- **深入 React**：Hooks 出了就系统学，搞懂 Concurrent Mode 的原理
- **Vue 3**：跟进 Alpha 版本，做技术储备
- **TypeScript**：把现有项目迁移，实践高级类型
- **Node.js**：学会用 Node 解决工程化问题，不只是写 API
- **计算机基础**：读《CSAPP》、刷 LeetCode，补齐短板

2019，继续努力。
