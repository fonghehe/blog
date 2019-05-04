---
title: "Angular 8 CLI Builders：自定义构建流程与 ng-add 方案"
date: 2019-05-04 10:06:41
tags:
  - Angular
---

Angular 8 正式开放了 **Builders API**，让社区可以为 `ng build`、`ng test`、`ng serve` 等命令提供自定义实现。这也是 `@angular-builders/custom-webpack` 、`@nrwl/workspace` 等不少优秀工具的基础。

## angular.json 中的 architect 配置

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/my-app",
            "index": "src/index.html",
            "main": "src/main.ts"
          },
          "configurations": {
            "production": {
              "optimization": true,
              "sourceMap": false
            }
          }
        }
      }
    }
  }
}
```

## 自定义构建器

```typescript
// builders/timestamp-copy/index.ts
import {
  createBuilder,
  BuilderOutput,
  BuilderContext,
} from "@angular-devkit/architect";
import * as fs from "fs";

export interface TimestampCopyOptions {
  sourceDir: string;
  targetDir: string;
}

export default createBuilder<TimestampCopyOptions>(
  async (options, context): Promise<BuilderOutput> => {
    context.logger.info(
      `开始拷贝: ${options.sourceDir} -> ${options.targetDir}`,
    );
    try {
      const timestamp = new Date().toISOString();
      const files = fs.readdirSync(options.sourceDir);
      if (!fs.existsSync(options.targetDir))
        fs.mkdirSync(options.targetDir, { recursive: true });
      files.forEach((file) => {
        fs.copyFileSync(
          `${options.sourceDir}/${file}`,
          `${options.targetDir}/${timestamp}-${file}`,
        );
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
);
```

```json
// builders.json
{
  "builders": {
    "timestamp-copy": {
      "implementation": "./timestamp-copy/index",
      "schema": "./timestamp-copy/schema.json",
      "description": "拷贝文件并添加时间戳"
    }
  }
}
```

## ng-add Schematics

`ng add` 允许库在被安装时自动执行配置逻辑：

```typescript
// schematics/ng-add/index.ts
import { Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { addModuleImportToRootModule } from "@angular/cdk/schematics";

export function ngAdd(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info("安装 MyLibrary...");
    // 自动向 AppModule 添加导入
    addModuleImportToRootModule(tree, "MyLibraryModule", "@my-org/my-library");
    return tree;
  };
}
```

这样用户只需要：

```bash
ng add @my-org/my-library
# 自动安装 npm 包 + 添加 AppModule 导入
```

## ng update 迁移路径

```bash
# 查看待更新的包
ng update

# 升级 Angular 8
ng update @angular/cli @angular/core

# ng update 会自动运行 migration schematic——包括
# 更新惰性加载语法为 import() 形式
```

## 总结

Angular Builders API 让 Angular CLI 不再是封闭的黑盒子。社区工具可以通过它的集成自定义构建流程，让 Angular 项目和现有 DevOps 流水线更容易合作。
