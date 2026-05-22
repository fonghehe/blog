---
title: "2018 前端工具链总结"
date: 2018-12-24 17:28:57
tags:
  - 前端
readingTime: 2
description: "快到年底了，把今年用过的前端工具做个汇总，顺便记录一下各工具的定位和选型思路。"
wordCount: 535
---

快到年底了，把今年用过的前端工具做个汇总，顺便记录一下各工具的定位和选型思路。

## 构建工具

**Webpack 4**（主力）

- 适合：复杂应用，需要代码分割、Tree Shaking、各种 loader
- 特点：功能最全，生态最丰富，配置也最复杂
- 当年版本：4.0（二月发布），显著提升了构建速度

**Parcel**（备选）

- 适合：快速原型、简单项目，零配置
- 特点：开箱即用，不需要配置文件
- 用过一次做内部工具，确实快

**Rollup**（库打包）

- 适合：打包 JS 库，生成干净的 ESM/CJS 格式
- 特点：Tree Shaking 比 Webpack 早支持，bundle 更小
- 发布 npm 包时用这个

## 包管理

**yarn**（当前主力）

- lockfile 更可靠，安装速度更快
- workspace 支持 monorepo

**npm 6**（也在用）

- 今年更新后速度提升很多
- package-lock.json 更完善了

## 代码质量

**ESLint**

- 用 `eslint-config-airbnb` 作为基础规则
- 配合 Vue 用 `eslint-plugin-vue`
- 提交代码前用 lint-staged 自动检查

**Prettier**

- 代码格式统一
- 和 ESLint 配合：ESLint 管逻辑错误，Prettier 管格式

**husky + lint-staged**

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,vue}": ["eslint --fix", "git add"],
    "*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

## 框架和库

**Vue 2.5**（工作项目）

- Vuex 3.x
- Vue Router 3.x
- Element UI（桌面端）
- Vant（移动端）

**React 16.x**（自学）

- Redux + Redux Thunk
- React Router v4

**TypeScript 3.x**

- 今年开始在新项目上用
- 比 JS 的类型安全确实香

## HTTP

**axios**（几乎所有项目都用）

- 封装拦截器统一处理认证和错误
- 支持取消请求

## 测试

**Jest**（单元测试）

- Vue Test Utils 配套

**Cypress**（E2E，刚开始用）

- 可以录制用户操作生成测试

## 开发体验

**VS Code**（主力编辑器）

- Vetur（Vue 支持）
- ESLint 插件
- Prettier 插件
- GitLens

**Chrome DevTools**

- Performance 面板（性能分析）
- Network 面板（网络分析）
- Application 面板（localStorage、Service Worker）

## 明年想关注的工具

```
Vite（尤雨溪在做，基于 ES module 的开发服务器）→ 还早，但值得关注
TypeScript 3.x 新特性
React Hooks（提案阶段）→ 感觉会改变 React 生态
```

## 小结

工具要选适合的，不是越新越好：

- 复杂应用 → Webpack
- 快速原型 → Parcel
- 发布库 → Rollup
- 代码质量 → ESLint + Prettier + lint-staged（必配）
- TypeScript 值得投入，提升开发体验和重构信心

2018 是前端工具链快速演进的一年，期待 2019 年有更多惊喜。
