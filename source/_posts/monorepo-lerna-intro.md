---
title: "Monorepo 实践入门：用 Lerna 管理多包项目"
date: 2018-10-23 17:02:40
tags:
  - 微前端
  - 工程化
---

公司有几个相互依赖的项目，一直用多仓库管理，联调和版本同步很麻烦。研究了一下 Monorepo，发现 Lerna 是当前最主流的方案。

## Monorepo vs Multirepo

**Multirepo（多仓库）**：每个项目/包一个 git 仓库

- 优点：职责清晰，互不干扰
- 缺点：跨包改动需要多次 PR，本地联调复杂，版本管理困难

**Monorepo（单仓库）**：多个包在一个 git 仓库

- 优点：原子提交，统一版本，联调方便
- 缺点：仓库变大，CI 需要更多配置

## Lerna 基础

```bash
npm install -g lerna
npx lerna init
```

生成结构：

```
my-monorepo/
├── packages/
│   ├── components/       # @myorg/components
│   ├── utils/            # @myorg/utils
│   └── admin/            # @myorg/admin（依赖上面两个）
├── lerna.json
└── package.json
```

```json
// lerna.json
{
  "version": "independent", // 各包独立版本
  "npmClient": "npm",
  "packages": ["packages/*"]
}
```

## 常用命令

```bash
# 创建新包
npx lerna create @myorg/utils packages/utils

# 给某个包安装依赖
npx lerna add lodash --scope=@myorg/components

# 包之间互相依赖（使用 symlink，不用发布）
npx lerna add @myorg/utils --scope=@myorg/admin

# 在所有包里运行命令
npx lerna run build          # 所有包运行 npm run build
npx lerna run test           # 所有包运行 npm run test
npx lerna run build --scope=@myorg/components  # 只跑某个包

# 发布
npx lerna publish
# 自动：检测有变动的包 → bump 版本 → 更新依赖 → 发布到 npm → 打 git tag
```

## 结合 Yarn Workspaces

Lerna + Yarn Workspaces 是目前最流行的组合：

```json
// 根目录 package.json
{
  "private": true,
  "workspaces": ["packages/*"]
}

// lerna.json
{
  "npmClient": "yarn",
  "useWorkspaces": true
}
```

Yarn Workspaces 处理依赖 hoisting（把公共依赖提升到根目录），Lerna 处理版本发布。

```bash
yarn install  # 一次安装所有包的依赖，公共依赖共享
```

## 实际结构示例

```
packages/
├── ui/
│   ├── src/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── index.ts
│   └── package.json
│       → { "name": "@myorg/ui", "version": "1.0.0" }
│
├── utils/
│   ├── src/
│   │   ├── format.ts
│   │   └── request.ts
│   └── package.json
│       → { "name": "@myorg/utils", "version": "1.0.0" }
│
└── admin-app/
    ├── src/
    └── package.json
        → { "dependencies": {
              "@myorg/ui": "^1.0.0",      // 本地包，symlink
              "@myorg/utils": "^1.0.0"    // 本地包，symlink
            } }
```

## 痛点

- 大仓库的 CI 时间会变长（需要只针对变化的包运行 CI）
- IDE 性能可能下降（node_modules 很大）
- 需要配置每个包的构建工具

Lerna 6.x 后对这些问题有了更好的支持（affected detection、task pipeline）。

## 小结

- Monorepo 适合相互依赖的多包项目
- Lerna 处理版本发布，Yarn Workspaces 处理依赖管理
- `lerna run build` 按拓扑顺序构建所有包
- 本地包通过 symlink 互相引用，无需发布到 npm 联调
