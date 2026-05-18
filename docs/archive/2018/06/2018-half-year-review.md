---
title: "2018 上半年：工程化体系建设与 Vue 深入实践"
date: 2018-06-28 10:43:27
tags:
  - 前端
readingTime: 5
description: "2018 上半年的核心工作围绕三件事：中后台系统的架构升级、内部组件库的从零搭建、以及工程化流水线的完善。这里做一个系统性的复盘，记录技术选型的思考和实际踩过的坑。"
---

2018 上半年的核心工作围绕三件事：中后台系统的架构升级、内部组件库的从零搭建、以及工程化流水线的完善。这里做一个系统性的复盘，记录技术选型的思考和实际踩过的坑。

## H1 重点项目回顾

### 中后台系统：Webpack 3 到 4 的迁移 + TypeScript 渐进引入

年初接手了一个跑了两年的中后台系统，技术栈是 Webpack 3 + Vue 2.3，构建时间稳定在 45 秒左右。当时面临两个选择：一是小修小补继续维护，二是做一次彻底的工程化升级。考虑到团队后续要并行维护多个中后台项目，我选择了后者。

**Webpack 4 升级**的核心收益不在版本号，而在于 mode 机制和 Tree Shaking 的优化。迁移过程中最大的阻力来自 plugin 生态的兼容性——好几个 Webpack 3 的 plugin 还没跟上 4.x，需要找替代方案或者自己写适配。最终构建时间从 45s 降到 12s，主要贡献来自两处：

```js
// webpack.config.js 关键配置
module.exports = {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

加上 `HardSourceWebpackPlugin` 做持久化缓存和路由懒加载，开发环境热更新体验好了很多。

**TypeScript 渐进式迁移**是更长期的投入。遗留代码里 `any` 泛滥，不可能一次性改完。采取的策略是：新模块强制 TS，旧模块通过 `allowJs` 逐步覆盖。到六月底，核心模块的覆盖率大概在 60%。这个过程中最大的收获是理解了类型系统不是"限制"，而是一种编译期的契约文档——特别是多人协作场景下，类型定义本身就是最好的接口说明。

## 组件库建设

上半年启动了内部共享组件库的建设。目标不是造一套新的 UI 框架，而是基于 Element UI 封装业务层通用组件：权限按钮、数据字典选择器、复杂搜索表单、通用 CRUD 表格等。

设计上做了几个关键决策：

- **Props 驱动，不侵入业务逻辑**：组件只关心 UI 和数据流，业务逻辑通过 slot 和 event 委托出去
- **TypeScript 类型导出**：每个组件同时导出类型定义，使用方有完整的类型提示
- **按需引入**：配合 `babel-plugin-component`，避免全量打包

```ts
// 组件类型导出示例
export interface CrudTableProps {
  columns: ColumnConfig[];
  fetchApi: (params: QueryParams) => Promise<PaginatedResult<any>>;
  rowKey?: string;
  toolbar?: ToolbarConfig[];
}
```

到六月底，组件库覆盖了 3 个中后台项目的 70% 通用场景，新项目初始化时间缩短了约 40%。

## 工程化改进

### CI 集成

之前团队部署靠手动 `npm run build` 然后 scp 到服务器，风险很高。上半年接入了 GitLab CI，pipeline 包含 lint -> test -> build -> deploy 四个阶段。关键配置：

```yaml
# .gitlab-ci.yml 核心流程
stages:
  - lint
  - test
  - build
  - deploy

lint:
  stage: lint
  script:
    - npm run lint
    - npm run type-check

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
```

部署环节接了钉钉通知，构建失败会自动 at 相关开发。上线事故追溯从"谁部署的"变成了"哪个 MR 引入的"。

### 代码质量工具链

ESLint + Prettier 的组合在团队落地花了比预期更长的时间——核心矛盾不是规则本身，而是存量代码的格式化成本。最终策略是：开启 `lint-staged` 只对改动文件做检查，存量代码通过一次批量格式化 PR 统一处理。配合 `commitlint` 规范 commit message，代码审查效率提升明显。

## 踩过的坑

**1. TypeScript 与 Vue 的兼容性问题**

Vue 2.x 对 TypeScript 的支持并不完美。`vue-property-decorator` 的装饰器语法在某些场景下类型推断会丢失，特别是 mixins 和 provide/inject。最终的解决方案是：mixins 尽量用 composition 的方式替代，provide/inject 显式声明类型。

**2. Webpack 4 的 sideEffects 配置**

Tree Shaking 不工作的排查花了半天，最终发现是 `package.json` 里没声明 `sideEffects: false`。加上之后 bundle 体积又减了 15%。这个教训说明：升级工具链不能只改配置文件，依赖库的 package.json 同样需要检查。

**3. Nuxt.js SSR 的坑**

做内容站 SEO 时用了 Nuxt，`window is not defined` 的问题反复出现。根本原因是第三方库在模块顶层访问了浏览器 API。解决方案是用 `process.client` 守卫，或者通过 `require` 在 mounted 阶段动态引入。这个坑让我认识到：SSR 不是换个框架就行，整条依赖链都需要适配。

## H2 规划

**技术深度：**

- TypeScript 高级类型系统：泛型约束、条件类型、模板字面量类型，在组件库中落地
- React 生态跟进：React 16.7 的 Hooks 特性值得深入，计划用一个内部项目做技术验证
- 前端测试体系：目前只有零散的单元测试，目标是搭建组件库的自动化测试 + CI 集成

**工程体系：**

- 前端监控接入 Sentry，覆盖错误捕获和性能指标上报
- 微前端调研：中后台系统越来越多，需要评估 qiankun / single-spa 的可行性
- Docker 化构建环境，统一团队的 Node 版本和构建依赖

**技术影响力：**

- 在团队内做 2-3 次技术分享（Webpack 优化、TypeScript 实践）
- 组件库文档站搭建，降低新人上手成本

## 小结

- 完成了中后台系统的 Webpack 4 升级和 TypeScript 渐进迁移，构建效率提升 73%
- 启动了业务组件库建设，覆盖 3 个项目的通用场景
- 落地了 GitLab CI 流水线和代码质量工具链，告别手动部署
- 解决了 Vue + TypeScript 兼容性、Webpack Tree Shaking、Nuxt SSR 等实际问题
- H2 重点方向：React 验证、测试体系、监控体系、微前端调研
