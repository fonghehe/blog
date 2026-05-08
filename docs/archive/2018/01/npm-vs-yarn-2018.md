---
title: "npm vs yarn：2018 年的选择"
date: 2018-01-20 11:10:29
tags:
  - Node.js
---

yarn 在 2016 年 10 月由 Facebook 发布，当时针对 npm 3 的痛点做了大量改进。两年过去了，npm 也推出了 npm 5，两者的差距缩小了。这篇文章聊一聊 2018 年初这两个工具的实际差异。

## yarn 当初解决了什么问题

yarn 刚出来时，相比 npm 3 有三个明显优势：

**1. 速度**：yarn 引入了本地缓存，同一个包第二次安装几乎是瞬间完成。npm 3 没有可靠的缓存机制，每次都要走网络。

**2. lockfile**：yarn 生成 `yarn.lock`，精确锁定所有依赖的版本（包括间接依赖）。npm 3 的 `npm-shrinkwrap.json` 需要手动运行命令生成，很多团队没养成这个习惯，导致"在我机器上能跑"的问题频发。

**3. 确定性安装**：相同的 `yarn.lock` 在不同机器上安装的 `node_modules` 结构完全一致。npm 3 的安装结果可能因为网络或时机不同而有差异。

## npm 5 的追赶

2017 年 5 月，npm 5 随 Node.js 8 发布，补上了很多短板：

- **`package-lock.json`**：类似 `yarn.lock`，自动生成，精确锁定版本
- **缓存改进**：使用 `~/.npm` 作为缓存目录，速度大幅提升
- **安装速度**：接近 yarn，部分场景更快

现在 npm 5 和 yarn 在功能上差异已经很小了。

## 2018 年实测对比

在一个中等规模项目（约 200 个依赖）上的实测：

| 操作                 | npm 5.6 | yarn 1.3 |
| -------------------- | ------- | -------- |
| 全新安装（无缓存）   | 45s     | 42s      |
| 全新安装（有缓存）   | 22s     | 12s      |
| 增量安装（只装新包） | 8s      | 5s       |
| `node_modules` 大小  | 312MB   | 298MB    |

yarn 仍然略快，但差距不再像两年前那么悬殊。

## 实际使用中的差异

**工作区（Workspaces）**：yarn 1.0 引入了 workspaces，适合 monorepo 项目管理多个包。npm 目前（5.x）还不支持，这是现在最大的功能差距。

```json
// yarn workspaces 配置（package.json）
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

**命令语法**：yarn 的命令更简短直观。

```bash
# 安装依赖
npm install        →  yarn
npm install axios  →  yarn add axios
npm install -D eslint  →  yarn add -D eslint

# 运行脚本
npm run build  →  yarn build（可以省略 run）
npm run test   →  yarn test
```

**错误信息**：yarn 的报错信息通常比 npm 更清晰，定位问题更容易。

## lockfile 的使用规范

不管用哪个工具，lockfile 都应该提交到 git：

```ini
# .gitignore

# 选一个，不要两个都用
# npm 项目：提交 package-lock.json
# yarn 项目：提交 yarn.lock

# 不要混用：如果用 yarn，把 package-lock.json 加入 gitignore
package-lock.json
```

团队里混用 npm 和 yarn 会导致 lockfile 冲突，强制统一工具版本：

```json
// package.json
{
  "engines": {
    "node": ">=8.0.0",
    "npm": ">=5.0.0"
  }
}
```

## 该选哪个

**选 yarn 的场景：**

- 需要 workspaces（monorepo 项目）
- 团队习惯了 yarn，迁移成本高
- CI 速度敏感（yarn 缓存利用率更高）

**选 npm 5+ 的场景：**

- 新项目，没有历史包袱
- 团队已经在用 npm，升到 5.x 即可
- 不需要 workspaces

**我的建议**：新项目用 npm 5+，除非有明确的 monorepo 需求。npm 是官方工具，跟随 Node.js 发布，不需要额外安装，维护成本更低。yarn 的主要优势已经大幅缩小，只有 workspaces 是目前的明显差异。

---

_下一篇：前端模块化：CommonJS 到 ES Module_
