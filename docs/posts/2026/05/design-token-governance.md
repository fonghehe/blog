---
title: "设计 Token 治理：让设计系统真正进入工程闭环"
date: 2026-05-26 11:13:54
tags:
  - 设计系统
  - CSS
readingTime: 6
description: "设计 Token 的价值不只是统一颜色和间距，更在于把设计决策变成可版本化、可审查、可发布的工程资产。本文讨论 Token 分层、变更评审和跨端同步。"
wordCount: 1519
---

设计 Token 的价值在 2026 年已经被广泛认可——但真正落地的团队并不多。问题不在于"要不要用 Token"，而在于"Token 怎么管才能不变成另一种烂代码"。本文从实际工程经验出发，讨论设计 Token 的分层架构、变更治理和跨端同步机制。

## Token 三层模型：不只是颜色和间距

业界主流的 Token 分层模型在 2026 年已经收敛为三个层级：

**第一层：基础 Token（Primitive / Global Tokens）**

这是最底层、最原子的设计决策。典型内容包括：

- 色板（如 `blue-500: #3B82F6`、`neutral-100: #F5F5F5`）
- 间距阶梯（如 `space-4: 4px`、`space-16: 16px`）
- 字号阶梯（如 `font-size-sm: 0.875rem`、`font-size-xl: 1.25rem`）
- 圆角、阴影、字重等基础属性

基础 Token 是**纯粹的值定义**，不包含语义。它们通常由设计工具（Figma Tokens Studio 等）直接导出，前端不应该手动修改。

**第二层：语义 Token（Semantic / Alias Tokens）**

这一层把基础 Token 映射到有意义的用途上：

- `color-text-primary` → `neutral-900`
- `color-surface-brand` → `blue-500`
- `spacing-card-padding` → `space-16`
- `font-size-heading` → `font-size-xl`

语义 Token 的关键价值在于**用途稳定，但值可以切换**。比如暗色模式下 `color-text-primary` 从 `neutral-900` 切换到 `neutral-100`，但组件代码完全不需要改。又比如品牌升级时只需要改 Token 映射关系，不用逐个组件改颜色值。

**第三层：组件 Token（Component Tokens）**

这一层直接对应组件库的具体组件：

- `button-primary-bg` → `color-surface-brand`
- `card-padding-x` → `spacing-card-padding`
- `input-border-radius` → `radius-md`

组件 Token 的优势是**显式化组件的设计依赖**。当你想知道一个 `Button` 组件用了哪些设计决策时，看它的 Token 就够了，不需要翻源码。

## Token 的工程化管理：从 Figma 到代码

2026 年比较成熟的工具链是：

1. **设计侧**：设计师在 Figma 中使用 Tokens Studio 插件定义 Token，导出为 JSON
2. **同步层**：使用 Style Dictionary 或 Tokens Studio 的 CI 插件，将 JSON 转换为多平台格式（CSS 变量、Tailwind 配置、iOS/Android 资源文件）
3. **消费侧**：前端组件通过 CSS 变量或 Tailwind 主题引用 Token

推荐的目录结构：

```
design-tokens/
├── primitives/
│   ├── colors.json
│   ├── spacing.json
│   └── typography.json
├── semantic/
│   ├── light.json
│   └── dark.json
├── components/
│   ├── button.json
│   └── card.json
├── build/
│   ├── css-variables.css
│   ├── tailwind.config.ts
│   └── index.ts
└── scripts/
    └── build-tokens.ts
```

## Token 变更的评审流程

Token 变更是高风险操作——改一个基础颜色可能影响几十个组件。2026 年的实践是建立 Token 专用的变更流程：

**变更类型分级：**

- **P3（新增 Token）**：添加新的 Token 值，不影响已有组件。正常 PR 流程即可。
- **P2（修改语义映射）**：如 `color-text-primary` 从 `neutral-900` 改为 `neutral-800`。需要提供视觉回归测试截图，并在 PR 中 @ 设计师审批。
- **P1（修改基础 Token）**：如修改色板中的 `blue-500` 值。需要发起 RFC，评估影响范围，并在 staging 环境中做全量回归。

**自动化检查：**

- Token JSON 的 Schema 校验（防止拼写错误和类型错误）
- 检测孤立的 Token（定义了但没有被引用）
- 检测未定义的引用（组件引用了不存在的 Token）
- 视觉回归测试（Chromatic / Percy 自动截图对比）

## 跨端同步：不止是 Web

设计 Token 的真正价值在跨端场景中才能完全体现。2026 年越来越多的团队需要同时支持 Web、小程序、React Native 和桌面端。Token 同步的挑战包括：

**平台差异映射：**
不同平台的能力不同。CSS 支持 `rgba()` 和 `var()`，小程序可能只支持 HEX 颜色。Transform 函数需要按平台生成不同的输出格式。好的做法是在 build 脚本中为每个平台维护一个 transformer，输入是统一的 Token JSON，输出是平台原生的格式。

**版本同步策略：**
设计 Token 的发布频率通常低于业务代码但高于大版本。推荐的节奏是：
- 每周从 Figma 同步最新 Token 到代码仓库
- 非破坏性变更（新增 Token、修改不影响现有组件语义映射的 Token）自动合并
- 破坏性变更触发人工审批流程

**暗色模式和多主题：**
Token 模型天然支持多主题，但需要注意：不是给每个组件写两套样式，而是让 Token 在不同主题下映射到不同值。组件代码本身应该是主题无关的：

```css
/* ✅ 正确：组件只引用语义 Token */
.button {
  background: var(--color-surface-brand);
  color: var(--color-text-on-brand);
}

/* ❌ 错误：组件直接引用基础 Token */
.button {
  background: var(--blue-500);
  color: var(--white);
}
```

## 团队协作中的 Token 治理

Token 治理最难的部分不是技术，而是人。设计师和开发者对 Token 的理解经常不在一个层面上。几个让协作更顺畅的实践：

1. **Token 是共同语言**：PR 讨论中用 Token 名称而不是具体值来沟通。"这个按钮用 `color-surface-brand` 是不是太重了"比"这个按钮的蓝色改成 #4A90D9"更有利于决策。

2. **Token 的 owner 是设计系统团队**：无论组织架构如何，设计 Token 需要有一个明确的 owner，负责审核变更、维护一致性和文档。

3. **入门文档不要只讲格式，要讲意图**：与其写"`spacing-md` 的值是 8px"，不如写"`spacing-md` 用于组件内部元素的间距，例如按钮内部的 padding、列表项之间的间距"。

4. **定期的 Token 审计**：每季度检查一次 Token 的使用情况。哪些 Token 从未被使用？哪些 Token 的值在不同端不一致？哪些 Token 的命名已经不能反映当前的设计意图？

## 小结

设计 Token 治理不是"导出 JSON 放到代码仓库"就完事了。它需要三层分层架构（基础→语义→组件）、工程化的构建管线、分级变更评审流程和跨端同步机制。更重要的是，Token 是设计和工程之间的契约——好的 Token 体系让设计师可以独立迭代设计语言，也让开发者不需要逐个像素地理解设计意图。2026 年的前端团队，如果还没有建立 Token 治理流程，现在就是最好的起点。
