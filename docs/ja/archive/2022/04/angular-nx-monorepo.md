---
title: "Angular + Nx Monorepo 実践：大規模フロントエンドプロジェクトの整理術"
date: 2022-04-27 10:22:33
tags:
  - Angular
  - フロントエンドエンジニアリング
readingTime: 3
description: "Nx は Monorepo 向けに設計されたビルドシステムで、Angular を第一級にサポートしています。大規模フロントエンドプロジェクトの二つの核心的な課題、**コード共有**（複数のアプリが同一のコンポーネント・ユーティリティライブラリを共用）と**ビルド速度**（影響を受けた部分のみ再ビルド）を解決します。この記事では Nx + Angular の実践的なアプローチを紹介します。"
wordCount: 577
---

Nx は Monorepo 向けに設計されたビルドシステムで、Angular を第一級にサポートしています。大規模フロントエンドプロジェクトの二つの核心的な課題、**コード共有**（複数のアプリが同一のコンポーネント・ユーティリティライブラリを共用）と**ビルド速度**（影響を受けた部分のみ再ビルド）を解決します。この記事では Nx + Angular の実践的なアプローチを紹介します。

## Nx Angular ワークスペースの作成

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

## 共有ライブラリの作成

```bash
# 创建 Angular 组件库
nx generate @nrwl/angular:library shared/ui --buildable

# 创建数据访问库（服务层）
nx generate @nrwl/angular:library shared/data-access --no-module

# 创建工具函数库
nx generate @nrwl/js:library shared/util
```

アプリ内で共有ライブラリを使う方法（TypeScript の path alias 経由）：

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

`tsconfig.base.json` のパスマッピング（Nx が自動管理）：

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

## Affected コマンド：影響を受けたプロジェクトのみビルド

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

## ビルドキャッシュ

Nx の分散キャッシュにより、繰り返しのビルドがほぼ即時に完了します：

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

## コードジェネレーターによる規約の統一

Nx ではカスタムコードジェネレーターを定義でき、チームのコードスタイルを一貫して保てます：

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

## モジュール境界の制約

Nx は ESLint ルールを通じてライブラリの依存方向を強制できます：

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

## まとめ

Nx + Angular の組み合わせは大規模プロジェクトで明確な優位性があります。`affected` コマンドにより CI 時間はプロジェクトの成長に対して線形に保たれ、指数的には増加しません。共有ライブラリは TypeScript path alias を通じてゼロ設定で再利用できます。モジュール境界の制約は循環依存やアーキテクチャの劣化を防ぎます。チームが2つ以上の Angular アプリケーションを保守し、コード共有のニーズがあるなら、Nx Monorepo は投資する価値のある選択肢です。