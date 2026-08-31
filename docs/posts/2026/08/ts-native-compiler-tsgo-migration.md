---
title: "原生 TypeScript 编译器 tsgo 迁移实战：Monorepo 从 tsc 到 Go 编译器的完整记录"
date: 2026-08-11 09:47:12
tags:
  - TypeScript
readingTime: 7
description: "将一个中型 Monorepo 从 tsc 迁移到 Go 原生编译器 tsgo 的完整过程：哪些场景真的变快了、配置和 API 层面的破坏性变更、CI 流水线调整、回滚策略，以及一份可直接复用的迁移清单。"
wordCount: 1750
---

TypeScript 7.x 系列发布后，社区讨论最多的不是类型系统的新特性，而是那个用 Go 重写的原生编译器 tsgo。微软在 TypeScript 7.0 中正式将 tsgo 作为可选编译器后端提供，目标是将大型项目的类型检查速度提升一个数量级。我在团队的一个中型 Monorepo（约 40 万行 TS/TSX，12 个 packages）上完成了从 tsc 到 tsgo 的迁移，这篇文章记录了真实过程中遇到的加速、阻碍和取舍。

## 什么变快了，什么没有

先说结论：tsgo 的类型检查确实快，但它不是所有场景的银弹。

| 操作 | tsc 耗时 | tsgo 耗时 | 提速比 |
|------|---------|----------|--------|
| 全量类型检查（`--noEmit`） | 48s | 6.2s | ~7.7x |
| 增量类型检查（单文件修改） | 3.8s | 0.4s | ~9.5x |
| 全量 emit（生成 .js + .d.ts） | 52s | 48s | ~1.1x |
| IDE 打开项目首次加载 | 12s | 2.1s | ~5.7x |
| IDE 编辑时诊断延迟 | 800ms | 90ms | ~8.9x |

类型检查和编辑器体验的提升是显著的——这正是 tsgo 的设计重心。Go 实现的编译器利用了并行类型检查和更高效的内存布局，在大规模代码库上的优势尤其明显。

但 emit（代码生成）阶段几乎没有提速。tsgo 目前只替换了类型检查管线，emit 仍然走原有的 TypeScript 编译器逻辑。如果你的瓶颈是构建产物生成而非类型检查，tsgo 不会带来明显改善。我们的生产构建使用 esbuild/Rolldown 做 emit，tsc/tsgo 仅用于类型验证，所以这个限制对我们影响不大。

## 配置与 API 层面的破坏性变更

迁移不是改个命令行参数就完事的。tsgo 对部分 tsconfig 选项和 Compiler API 的支持存在差异。

### Module Resolution 的边缘情况

我们项目中有一个内部 packages 引用链，使用了 `paths` + `baseUrl` + `exports` 三层映射的组合。tsc 能正确解析，但 tsgo 在以下场景中表现不同：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"],
      "@app/utils": ["packages/utils/src/index.ts"] // 精确映射
    }
  }
}
```

问题出在精确路径映射（不带通配符）与 `exports` 字段的优先级上。tsc 会先匹配 `paths` 中的精确映射，再 fallback 到 package.json 的 `exports`；tsgo 在某些情况下优先走了 `exports` 解析，导致指向了编译后的 `.d.ts` 而非源码。

解决方案是在 tsconfig 中显式指定 `customConditions`，确保 tsgo 走到正确的解析分支：

```jsonc
{
  "compilerOptions": {
    "customConditions": ["source"],
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

同时在被引用的 package.json 中添加对应的 condition：

```json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

### Transformer 插件不兼容

这是迁移中最大的阻碍。我们之前使用了两个自定义 transformer：

1. `typescript-transform-paths`：编译时将绝对路径重写为相对路径
2. `ts-nameof`：编译时提取变量名用于日志

tsgo 不支持 TypeScript Compiler API 中的 `createProgram` + custom transformers 接口。它有自己的 Program API，但表面积极小，无法注入自定义转换步骤。

对于 `typescript-transform-paths`，我们改用构建工具层面解决——Rolldown/esbuild 本身就能处理路径别名，不需要编译器介入。

对于 `ts-nameof`，我们在迁移前将其替换为手动字符串常量。这是一个权衡：失去了编译时自动提取的便利，但消除了对非标准编译器扩展的依赖。

### Program API 的限制

如果你有基于 `ts.createProgram` 的自定义工具（如代码生成器、文档提取器），需要注意 tsgo 的 Program API 是一个精简子集。以下 API 在 tsgo 中不可用或行为不同：

- `program.getTypeChecker()` — 可用，但返回的 TypeChecker 缺少部分高级方法（如 `getSymbolAtLocation` 在某些节点类型上不工作）
- `program.getSourceFiles()` — 可用
- `typeChecker.getWidenedLiteralType()` — 不可用
- 自定义 `CompilerHost` — 不支持

我们的内部 API 文档生成工具依赖了这些 API，迁移后改为使用 `ts-morph`（它仍然绑定 tsc）独立运行，不与 tsgo 共享进程。

## CI 流水线的改造

迁移前我们的 CI typecheck 步骤：

```yaml
# 旧配置
- name: Type Check
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

迁移后：

```yaml
# 新配置
- name: Install tsgo
  run: npm install -g @typescript/native-tsgo

- name: Type Check (tsgo)
  run: tsgo --noEmit -p tsconfig.json
  timeout-minutes: 2

- name: Type Check (tsc fallback)
  if: failure()
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

关键的改动是保留了 tsc 作为 fallback。在迁移的前三个月里，tsgo 偶尔会在某些边缘语法上报出误报（false positive），此时 CI 会自动回退到 tsc 验证，避免阻塞合并流程。我们同时会将误报案例提交给 TypeScript 团队的 issue tracker。

实际效果：CI 中 typecheck 步骤的平均耗时从 48 秒降到 7 秒（包含 tsgo 安装时间约 1 秒）。对于一个日均 30+ PR 的团队，这意味着每天节省约 20 分钟的 CI 等待时间。

我们还加了一个双跑对比阶段，在迁移初期同时运行 tsc 和 tsgo，比对两者的诊断输出是否一致：

```bash
#!/bin/bash
# scripts/typecheck-compare.sh
tsgo --noEmit 2>&1 | sort > /tmp/tsgo-out.txt
tsc --noEmit 2>&1 | sort > /tmp/tsc-out.txt
diff /tmp/tsgo-out.txt /tmp/tsc-out.txt > /tmp/diff.txt
if [ -s /tmp/diff.txt ]; then
  echo "Diagnosis mismatch detected:"
  cat /tmp/diff.txt
  exit 1
fi
echo "Both compilers agree."
```

这个脚本在迁移的第一个月作为 CI 必跑步骤，确认两者输出稳定一致后才降级为可选手动触发。

## 回滚策略

迁移 tsgo 是可逆的，但需要提前规划好回滚路径：

1. **保留 tsc 依赖**：不要从 devDependencies 中移除 typescript 包。tsgo 是独立安装的，两者可以共存
2. **tsconfig 兼容性**：保持一份 `tsconfig.tsc.json` 作为 tsc 专用配置，当需要回退时使用 `-p tsconfig.tsc.json`
3. **CI 开关**：通过环境变量控制使用哪个编译器，而非硬编码

```yaml
- name: Type Check
  run: |
    if [ "$USE_TSGO" = "true" ]; then
      tsgo --noEmit -p tsconfig.json
    else
      npx tsc --noEmit -p tsconfig.tsc.json
    fi
  env:
    USE_TSGO: ${{ vars.USE_TSGO || 'true' }}
```

4. **IDE 配置**：VS Code 的 TypeScript 插件支持选择编译器版本。在 `.vscode/settings.json` 中指定：

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "./node_modules/@typescript/native-tsgo/lib"
}
```

回退时只需改回 `"./node_modules/typescript/lib"`。

## 哪些项目应该等一等

不是所有项目都适合现在迁移。根据我的经验，以下情况建议观望：

**应该等的：**
- 使用了自定义 transformer 插件且无法替代的项目
- 依赖 `ts.createProgram` API 构建内部工具的 monorepo
- tsconfig 中大量使用 `paths` + `rootDirs` + `composite` 组合的复杂配置
- 对 TypeScript 最新语法特性的前沿使用者（tsgo 对新语法的跟进通常晚于 tsc 1-2 个 minor 版本）

**可以放心迁移的：**
- 以类型检查为主要用途（`--noEmit`），emit 由其他工具负责
- 标准 ESM/CJS 模块解析，无复杂的 path mapping
- 纯业务代码项目，不依赖编译器扩展
- 大型 monorepo，类型检查耗时已成为开发体验瓶颈

## 迁移清单

以下是我整理的可直接复用的迁移步骤：

```markdown
## tsgo 迁移清单

### 前置检查
- [ ] 确认不使用自定义 transformer（或已有替代方案）
- [ ] 确认不依赖 tsc-only Compiler API
- [ ] 备份当前 tsconfig.json
- [ ] 创建 tsconfig.tsc.json 作为回退配置

### 安装与配置
- [ ] 安装 @typescript/native-tsgo
- [ ] 验证 tsgo --version 正常输出
- [ ] 运行 tsgo --noEmit 检查是否有误报
- [ ] 修复 module resolution 差异（如有）
- [ ] 配置 IDE 使用 tsgo

### CI 集成
- [ ] 添加 tsgo 安装步骤
- [ ] 替换 typecheck 命令
- [ ] 添加 tsc fallback 逻辑
- [ ] 运行双跑对比脚本（至少两周）
- [ ] 确认诊断输出一致后移除双跑

### 验证与监控
- [ ] 对比迁移前后 CI typecheck 耗时
- [ ] 收集团队成员 IDE 体验反馈
- [ ] 跟踪 TypeScript release notes 中的 tsgo 修复
- [ ] 一个月后评估是否完全切换
```

## 展望

tsgo 代表了 TypeScript 工程化的一个重要方向：将开发者日常最频繁的操作（类型检查、编辑器响应）做到极致性能，同时保持生态兼容。当前的限制（emit 未加速、API 不完整）是阶段性问题，TypeScript 团队已经明确了后续路线图。

对于大多数前端团队来说，现在是一个合理的迁移窗口——前提是你清楚自己的项目在哪些方面会受益、哪些方面可能踩坑。不要为了追新而迁移，也不要因为保守而错过真实的效率提升。先用清单评估，再用数据决策。
