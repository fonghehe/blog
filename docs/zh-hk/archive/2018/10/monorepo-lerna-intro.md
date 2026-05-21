---
title: "Monorepo 實踐入門：用 Lerna 管理多包項目"
date: 2018-10-23 17:02:40
tags:
  - 微前端
  - 工程化
readingTime: 2
description: "公司有幾個相互依賴的項目，一直用多倉庫管理，聯調和版本同步很麻煩。研究了一下 Monorepo，發現 Lerna 是當前最主流的方案。"
wordCount: 331
---

公司有幾個相互依賴的項目，一直用多倉庫管理，聯調和版本同步很麻煩。研究了一下 Monorepo，發現 Lerna 是當前最主流的方案。

## Monorepo vs Multirepo

**Multirepo（多倉庫）**：每個項目/包一個 git 倉庫

- 優點：職責清晰，互不干擾
- 缺點：跨包改動需要多次 PR，本地聯調複雜，版本管理困難

**Monorepo（單倉庫）**：多個包在一個 git 倉庫

- 優點：原子提交，統一版本，聯調方便
- 缺點：倉庫變大，CI 需要更多配置

## Lerna 基礎

```bash
npm install -g lerna
npx lerna init
```

生成結構：

```
my-monorepo/
├── packages/
│   ├── components/       # @myorg/components
│   ├── utils/            # @myorg/utils
│   └── admin/            # @myorg/admin（依賴上面兩個）
├── lerna.json
└── package.json
```

```json
// lerna.json
{
  "version": "independent", // 各包獨立版本
  "npmClient": "npm",
  "packages": ["packages/*"]
}
```

## 常用命令

```bash
# 創建新包
npx lerna create @myorg/utils packages/utils

# 給某個包安裝依賴
npx lerna add lodash --scope=@myorg/components

# 包之間互相依賴（使用 symlink，不用發佈）
npx lerna add @myorg/utils --scope=@myorg/admin

# 在所有包裏運行命令
npx lerna run build          # 所有包運行 npm run build
npx lerna run test           # 所有包運行 npm run test
npx lerna run build --scope=@myorg/components  # 只跑某個包

# 發佈
npx lerna publish
# 自動：檢測有變動的包 → bump 版本 → 更新依賴 → 發佈到 npm → 打 git tag
```

## 結合 Yarn Workspaces

Lerna + Yarn Workspaces 是目前最流行的組合：

```json
// 根目錄 package.json
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

Yarn Workspaces 處理依賴 hoisting（把公共依賴提升到根目錄），Lerna 處理版本發佈。

```bash
yarn install  # 一次安裝所有包的依賴，公共依賴共享
```

## 實際結構示例

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

## 痛點

- 大倉庫的 CI 時間會變長（需要只針對變化的包運行 CI）
- IDE 性能可能下降（node_modules 很大）
- 需要配置每個包的構建工具

Lerna 6.x 後對這些問題有了更好的支持（affected detection、task pipeline）。

## 小結

- Monorepo 適合相互依賴的多包項目
- Lerna 處理版本發佈，Yarn Workspaces 處理依賴管理
- `lerna run build` 按拓撲順序構建所有包
- 本地包通過 symlink 互相引用，無需發佈到 npm 聯調
