---
title: "Angular + Nx Monorepo in Practice: Organizing Large Frontend Projects"
date: 2022-04-27 10:22:33
tags:
  - Angular
  - Frontend Engineering
readingTime: 2
description: "Nx is a build system designed for monorepos with first-class Angular support. It solves two core problems in large frontend projects: **code sharing** (multiple apps sharing the same component/utility libraries) and **build speed** (only rebuilding what's affected). This article walks through Nx + Angular in practice."
wordCount: 196
---

Nx is a build system designed for monorepos with first-class Angular support. It solves two core problems in large frontend projects: **code sharing** (multiple apps sharing the same component/utility libraries) and **build speed** (only rebuilding what's affected). This article walks through Nx + Angular in practice.

## Creating an Nx Angular Workspace

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

## Creating Shared Libraries

```bash
# 创建 Angular 组件库
nx generate @nrwl/angular:library shared/ui --buildable

# 创建数据访问库（服务层）
nx generate @nrwl/angular:library shared/data-access --no-module

# 创建工具函数库
nx generate @nrwl/js:library shared/util
```

Using shared libraries in apps (via TypeScript path aliases):

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

Path mappings in `tsconfig.base.json` (managed automatically by Nx):

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

## Affected Commands: Only Build What Changed

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

## Build Caching

Nx's distributed caching makes repeated builds nearly instant:

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

## Code Generators for Consistent Conventions

Nx lets you define custom code generators to keep team code style consistent:

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

## Module Boundary Constraints

Nx can enforce library dependency direction through ESLint rules:

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

## Summary

The Nx + Angular combination shines in large projects: the `affected` command keeps CI time linear rather than exponential as the project grows; shared libraries reuse code with zero configuration via TypeScript path aliases; and module boundary constraints prevent circular dependencies and architectural decay. If your team maintains more than two Angular apps and needs to share code, an Nx monorepo is a worthwhile investment.