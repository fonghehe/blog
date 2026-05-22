---
title: "2024 Year-End Summary: Seven Years in Frontend, the AI Year"
date: 2024-12-30 16:04:41
tags:
  - Engineering
readingTime: 2
description: "Seven years. I started this blog in 2018, and today I'm writing my seventh year-end summary."
wordCount: 514
---

Seven years. I started this blog in 2018, and today I'm writing my seventh year-end summary.

## 2024 Frontend Technology Landscape

**框架层**没有革命，但有持续进化：

```
React 19：Actions API 成熟，Server Components 落地
Vue 3.4/3.5：defineModel、useTemplateRef 等 DX 改进
Next.js 15：Turbopack 默认，React 19 支持
Nuxt 3：稳定、生产可用
Astro 4：内容网站的最佳选择
```

**工具链**有显著改进：

```
Biome：Rust 工具链，速度革命
Tailwind CSS 4 Beta：Oxide 引擎，配置迁移到 CSS
TypeScript 5.x：装饰器正式标准，NoInfer 等
Vite 5：持续优化，Rolldown（Rust 重写）在路上
```

**最大的变化是 AI**：

```
GitHub Copilot：代码补全成熟，Copilot Chat 可用
Claude 3.5 Sonnet：复杂问题分析的首选
Cursor IDE：AI 原生编辑器，越来越多人迁移
v0.dev：UI 原型生成
```

## My 2024

工作上，今年主要做了两件事：

一是**推动团队的工具链升级**。带着团队从 ESLint + Prettier 迁移到 Biome（格式化部分），把 CI lint 时间从 45s 降到了 5s。这个项目让我意识到，工程师的价值不只是写新功能，也包括降低团队的"摩擦成本"。

二是**建立前端设计规范**。和设计师合作，从 Figma 变量到代码 CSS 变量，建立了一套真正能同步的设计 token 系统。这个过程比我想象的难，不是技术难，是沟通难。

**个人学习**上，今年学了很多 AI 工具相关的内容。不是"怎么用 ChatGPT"，而是"怎么把 AI 工具整合进工作流"。这个思路转变让我的效率提升了不少。

## Things AI Tools Made Me Reconsider

当 AI 能快速生成样板代码，什么能力变得更重要？

```
更重要的：
- 系统设计和架构判断
- 需求分析和问题定义
- Code Review 和代码质量把关
- 跨团队沟通和协作
- 安全意识和风险评估

不那么重要的：
- 记住 API 参数
- 写样板代码
- 查文档
```

感觉自己的角色在向"工程决策者"方向移动，而不只是"代码实现者"。这既让我兴奋，也让我有点焦虑。

## 2025 Outlook

技术层面：

```
React 19 正式版发布（很快了）
Tailwind CSS 4 正式版
Vite 的 Rolldown 进展
TypeScript 6.0 可能
Web Components 继续复苏？
```

我个人想做的：

```
- 深入学习系统设计（不只是前端）
- 贡献一个开源项目（而不只是提 issue）
- 写更多关于工程化和团队协作的文章
- 减少对新框架的追逐，深化对基础的理解
```

## Rating My 2024 Self

- 技术成长：7/10（AI 工具整合做得不错，但基础知识深化不够）
- 工程影响：8/10（工具链升级和设计规范是有影响力的事）
- 写作：6/10（文章数量比往年少，质量还行）
- 工作生活平衡：7/10（还可以，但还有提升空间）

## Closing Thoughts

七年了，前端还在快速变化，我也在跟着变。有时候觉得累，有时候觉得兴奋。但总体来说，我很庆幸选择了这个领域——它让我一直有东西可以学，一直有理由写东西。

明年见。

---

_本文写于 2024 年 12 月 30 日，2018-2024 七年前端。_
