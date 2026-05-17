---
title: "Angular 8 CLI Builders：カスタムビルドパイプラインとng-addソリューション"
date: 2019-05-04 10:06:41
tags:
  - Angular
readingTime: 1
description: "Angular 8は**Builders API**を正式に公開し、コミュニティが`ng build`、`ng test`、`ng serve`などのコマンドに対してカスタム実装を提供できるようになりました。これは`@angular-builders/custom-webpack`や`@nrwl/workspace`な"
---

Angular 8は**Builders API**を正式に公開し、コミュニティが`ng build`、`ng test`、`ng serve`などのコマンドに対してカスタム実装を提供できるようになりました。これは`@angular-builders/custom-webpack`や`@nrwl/workspace`などの多くの優れたツールの基盤にもなっています。

## angular.jsonのarchitect設定

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

## カスタムビルダー

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
      `コピー開始: ${options.sourceDir} -> ${options.targetDir}`,
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
      "implementation": "./index",
      "schema": "./schema.json",
      "description": "タイムスタンププレフィックスでファイルをコピー"
    }
  }
}
```

Builders APIを使えば、フレームワークをフォークせずにAngularのビルドパイプラインを深くカスタマイズできます。高度なビルド要件を持つチームにとって強力な拡張ポイントです。
