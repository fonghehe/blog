---
title: "Angular + Nx Monorepo 实践：大型前端项目的组织之道"
date: 2022-04-27 10:22:33
tags:
  - Angular
  - 前端工程化
readingTime: 2
description: "Nx 是专为 Monorepo 设计的构建系统，对 Angular 有一流支持。它解决了大型前端项目的两个核心问题：**代码共享**（多个应用共用同一套组件/工具库）和**构建速度**（只重新构建受影响的部分）。这篇文章介绍 Nx + Angular 的实践方案。"
---

Nx 是专为 Monorepo 设计的构建系统，对 Angular 有一流支持。它解决了大型前端项目的两个核心问题：**代码共享**（多个应用共用同一套组件/工具库）和**构建速度**（只重新构建受影响的部分）。这篇文章介绍 Nx + Angular 的实践方案。

## 创建 Nx Angular 工作区

```bash
# 创建新的 Nx + Angular 工作区
npx create-nx-workspace@latest my-org --preset=angular

# 或在现有 Angular 项目中添加 Nx
ng add @nrwl/angular
```

生成的目录结构：

```
my-org/
├── apps/
│   ├── admin/           # 管理后台应用
│   └── customer/        # 用户端应用
├── libs/
│   ├── shared/
│   │   ├── ui/          # 共享 UI 组件库
│   │   ├── data-access/ # API 服务层
│   │   └── util/        # 工具函数
│   └── admin/
│       └── feature-users/ # 管理端用户功能
├── nx.json
└── workspace.json
```

## 创建共享库

```bash
# 创建 Angular 组件库
nx generate @nrwl/angular:library shared/ui --buildable

# 创建数据访问库（服务层）
nx generate @nrwl/angular:library shared/data-access --no-module

# 创建工具函数库
nx generate @nrwl/js:library shared/util
```

在应用中使用共享库（通过 TypeScript path alias）：

```typescript
// apps/admin/src/app/app.module.ts
import { ButtonComponent } from "@my-org/shared/ui";
import { UserService } from "@my-org/shared/data-access";
import { formatDate } from "@my-org/shared/util";

@NgModule({
  imports: [ButtonComponent], // 假设是 standalone 组件
  providers: [UserService],
})
export class AppModule {}
```

`tsconfig.base.json` 中的路径映射（Nx 自动管理）：

```json
{
  "compilerOptions": {
    "paths": {
      "@my-org/shared/ui": ["libs/shared/ui/src/index.ts"],
      "@my-org/shared/data-access": ["libs/shared/data-access/src/index.ts"],
      "@my-org/shared/util": ["libs/shared/util/src/index.ts"]
    }
  }
}
```

## Affected 命令：只构建受影响的项目

```bash
# 只测试受当前变更影响的项目（对比 main 分支）
nx affected:test --base=main

# 只构建受影响的应用
nx affected:build --base=main

# 只 lint 受影响的项目
nx affected:lint --base=main

# 查看依赖图，了解改动影响范围
nx graph
```

## 构建缓存

Nx 的分布式缓存让重复构建几乎是即时的：

```bash
# 第一次构建
nx build admin  # 需要 45s

# 代码没有变化，第二次构建
nx build admin  # 立即完成（命中缓存）
```

缓存配置（`nx.json`）：

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "accessToken": "YOUR_NX_CLOUD_TOKEN",
        "cacheableOperations": ["build", "test", "lint", "e2e"]
      }
    }
  }
}
```

## 代码生成器统一规范

Nx 允许自定义代码生成器，确保团队代码风格一致：

```bash
# 生成标准功能模块（内含 component, service, routing）
nx generate @my-org/angular:feature feature-orders --project=admin

# 自定义生成器示例
# tools/generators/feature/index.ts
export default async function(tree: Tree, options: FeatureGeneratorSchema) {
  generateFiles(tree, path.join(__dirname, 'files'), options.path, options);
  await formatFiles(tree);
}
```

## 模块边界约束

Nx 可以通过 ESLint 规则强制库的依赖方向：

```json
// .eslintrc.json
{
  "rules": {
    "@nrwl/nx/enforce-module-boundaries": [
      "error",
      {
        "depConstraints": [
          {
            "sourceTag": "type:app",
            "onlyDependOnLibsWithTags": ["type:feature", "type:shared"]
          },
          {
            "sourceTag": "type:feature",
            "onlyDependOnLibsWithTags": [
              "type:data-access",
              "type:shared",
              "type:ui"
            ]
          },
          {
            "sourceTag": "type:shared",
            "onlyDependOnLibsWithTags": ["type:shared"]
          }
        ]
      }
    ]
  }
}
```

## 总结

Nx + Angular 的组合在大型项目中优势明显：`affected` 命令让 CI 时间随项目增长保持线性而非指数级增长；共享库通过 TypeScript path alias 实现零配置复用；模块边界约束防止循环依赖和架构腐化。如果你的团队维护 2 个以上 Angular 应用并有共享代码的需求，Nx Monorepo 是值得投入的选项。