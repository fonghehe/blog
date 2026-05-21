---
title: "Angular 8 CLI Builders: Custom Build Pipelines and ng-add Solutions"
date: 2019-05-04 10:06:41
tags:
  - Angular
readingTime: 1
description: "Angular 8 has officially opened the **Builders API**, allowing the community to provide custom implementations for commands like `ng build`, `ng test`, and `ng "
wordCount: 72
---

Angular 8 has officially opened the **Builders API**, allowing the community to provide custom implementations for commands like `ng build`, `ng test`, and `ng serve`. This is also the foundation for many excellent tools such as `@angular-builders/custom-webpack` and `@nrwl/workspace`.

## architect Configuration in angular.json

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

## Custom Builder

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
      `Copying: ${options.sourceDir} -> ${options.targetDir}`,
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
      "description": "Copy files with timestamp prefix"
    }
  }
}
```

The Builders API makes it possible to deeply customize Angular's build pipeline without forking the framework — a powerful extension point for teams with advanced build requirements.
