---
title: "Angular 8 CLI Builders：自定義構建流程與 ng-add 方案"
date: 2019-05-04 10:06:41
tags:
  - Angular
readingTime: 1
description: "Angular 8 正式開放了 **Builders API**，讓社群可以為 `ng build`、`ng test`、`ng serve` 等命令提供自定義實現。這也是 `@angular-builders/custom-webpack` 、`@nrwl/workspace` 等不少優秀工具的基礎。"
wordCount: 148
---

Angular 8 正式開放了 **Builders API**，讓社群可以為 `ng build`、`ng test`、`ng serve` 等命令提供自定義實現。這也是 `@angular-builders/custom-webpack` 、`@nrwl/workspace` 等不少優秀工具的基礎。

## angular.json 中的 architect 設定

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

## 自定義構建器

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
      `開始複製: ${options.sourceDir} -> ${options.targetDir}`,
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
      "description": "複製檔案並新增時間戳"
    }
  }
}
```

## ng-add Schematics

`ng add` 允許庫在被安裝時自動執行配置邏輯：

```typescript
// schematics/ng-add/index.ts
import { Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { addModuleImportToRootModule } from "@angular/cdk/schematics";

export function ngAdd(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info("安裝 MyLibrary...");
    // 自動向 AppModule 新增匯入
    addModuleImportToRootModule(tree, "MyLibraryModule", "@my-org/my-library");
    return tree;
  };
}
```

這樣使用者隻需要：

```bash
ng add @my-org/my-library
# 自動安裝 npm 包 + 新增 AppModule 匯入
```

## ng update 遷移路徑

```bash
# 檢視待更新的包
ng update

# 升級 Angular 8
ng update @angular/cli @angular/core

# ng update 會自動執行 migration schematic——包括
# 更新惰性載入語法為 import() 形式
```

## 總結

Angular Builders API 讓 Angular CLI 不再是封閉的黑盒子。社群工具可以通過它的整合自定義構建流程，讓 Angular 專案和現有 DevOps 流水線更容易合作。
