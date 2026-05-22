---
title: "Angular + Nx Monorepo 實踐：大型前端項目的組織之道"
date: 2022-04-27 10:22:33
tags:
  - Angular
  - 前端工程化
readingTime: 2
description: "Nx 是專為 Monorepo 設計的構建系統，對 Angular 有一流支援。它解決了大型前端項目的兩個核心問題：**代碼共享**（多個應用共用同一套組件/工具庫）和**構建速度**（隻重新構建受影響的部分）。這篇文章介紹 Nx + Angular 的實踐方案。"
wordCount: 340
---

Nx 是專為 Monorepo 設計的構建系統，對 Angular 有一流支援。它解決了大型前端項目的兩個核心問題：**代碼共享**（多個應用共用同一套組件/工具庫）和**構建速度**（隻重新構建受影響的部分）。這篇文章介紹 Nx + Angular 的實踐方案。

## 創建 Nx Angular 工作區

```bash
# 創建新的 Nx + Angular 工作區
npx create-nx-workspace@latest my-org --preset=angular

# 或在現有 Angular 項目中添加 Nx
ng add @nrwl/angular
```

生成的目錄結構：

```
my-org/
├── apps/
│   ├── admin/           # 管理後臺應用
│   └── customer/        # 用户端應用
├── libs/
│   ├── shared/
│   │   ├── ui/          # 共享 UI 組件庫
│   │   ├── data-access/ # API 服務層
│   │   └── util/        # 工具函數
│   └── admin/
│       └── feature-users/ # 管理端用户功能
├── nx.json
└── workspace.json
```

## 創建共享庫

```bash
# 創建 Angular 組件庫
nx generate @nrwl/angular:library shared/ui --buildable

# 創建數據訪問庫（服務層）
nx generate @nrwl/angular:library shared/data-access --no-module

# 創建工具函數庫
nx generate @nrwl/js:library shared/util
```

在應用中使用共享庫（通過 TypeScript path alias）：

```typescript
// apps/admin/src/app/app.module.ts
import { ButtonComponent } from "@my-org/shared/ui";
import { UserService } from "@my-org/shared/data-access";
import { formatDate } from "@my-org/shared/util";

@NgModule({
  imports: [ButtonComponent], // 假設是 standalone 組件
  providers: [UserService],
})
export class AppModule {}
```

`tsconfig.base.json` 中的路徑映射（Nx 自動管理）：

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

## Affected 命令：隻構建受影響的項目

```bash
# 隻測試受當前變更影響的項目（對比 main 分支）
nx affected:test --base=main

# 隻構建受影響的應用
nx affected:build --base=main

# 隻 lint 受影響的項目
nx affected:lint --base=main

# 查看依賴圖，瞭解改動影響範圍
nx graph
```

## 構建緩存

Nx 的分佈式緩存讓重複構建幾乎是即時的：

```bash
# 第一次構建
nx build admin  # 需要 45s

# 代碼沒有變化，第二次構建
nx build admin  # 立即完成（命中緩存）
```

緩存配置（`nx.json`）：

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

## 代碼生成器統一規範

Nx 允許自定義代碼生成器，確保團隊代碼風格一致：

```bash
# 生成標準功能模塊（內含 component, service, routing）
nx generate @my-org/angular:feature feature-orders --project=admin

# 自定義生成器示例
# tools/generators/feature/index.ts
export default async function(tree: Tree, options: FeatureGeneratorSchema) {
  generateFiles(tree, path.join(__dirname, 'files'), options.path, options);
  await formatFiles(tree);
}
```

## 模塊邊界約束

Nx 可以通過 ESLint 規則強製庫的依賴方向：

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

## 總結

Nx + Angular 的組合在大型項目中優勢明顯：`affected` 命令讓 CI 時間隨項目增長保持線性而非指數級增長；共享庫通過 TypeScript path alias 實現零設定複用；模塊邊界約束防止循環依賴和架構腐化。如果你的團隊維護 2 個以上 Angular 應用並有共享代碼的需求，Nx Monorepo 是值得投入的選項。