---
title: "npm vs yarn：2018 年的選擇"
date: 2018-01-20 11:10:29
tags:
  - Node.js
readingTime: 3
description: "yarn 在 2016 年 10 月由 Facebook 發布，當時針對 npm 3 的痛點做了大量改進。兩年過去了，npm 也推出了 npm 5，兩者的差距縮小了。這篇文章聊聊 2018 年初這兩個工具的實際差異。"
wordCount: 719
---

yarn 在 2016 年 10 月由 Facebook 發布，當時針對 npm 3 的痛點做了大量改進。兩年過去了，npm 也推出了 npm 5，兩者的差距縮小了。這篇文章聊聊 2018 年初這兩個工具的實際差異。

## yarn 當初解決了什麼問題

yarn 剛出來時，相比 npm 3 有三個明顯優勢：

**1. 速度**：yarn 引入了本機快取，同一個套件第二次安裝幾乎是瞬間完成。npm 3 沒有可靠的快取機製，每次都要走網路。

**2. lockfile**：yarn 產生 `yarn.lock`，精確鎖定所有依賴的版本（包含間接依賴）。npm 3 的 `npm-shrinkwrap.json` 需要手動執行指令產生，很多團隊沒養成這個習慣，導致「在我機器上能跑」的問題頻繁發生。

**3. 確定性安裝**：相同的 `yarn.lock` 在不同機器上安裝的 `node_modules` 結構完全一致。npm 3 的安裝結果可能因為網路或時機不同而有差異。

## npm 5 的追趕

2017 年 5 月，npm 5 隨 Node.js 8 發布，補上了很多不足：

- **`package-lock.json`**：類似 `yarn.lock`，自動產生，精確鎖定版本
- **快取改進**：使用 `~/.npm` 作為快取目錄，速度大幅提升
- **安裝速度**：接近 yarn，部分場景更快

現在 npm 5 和 yarn 在功能上差異已經很小了。

## 2018 年實測對比

在一個中等規模專案（約 200 個依賴）上的實測：

| 操作                   | npm 5.6 | yarn 1.3 |
| 
---------------------- | ------- | -------- |
| 全新安裝（無快取）     | 45s     | 42s      |
| 全新安裝（有快取）     | 22s     | 12s      |
| 增量安裝（隻裝新套件） | 8s      | 5s       |
| `node_modules` 大小    | 312MB   | 298MB    |

yarn 仍然略快，但差距不再像兩年前那麼懸殊。

## 實際使用中的差異

**工作區（Workspaces）**：yarn 1.0 引入了 workspaces，適合 monorepo 專案管理多個套件。npm 目前（5.x）還不支援，這是現在最大的功能差距。

```json
// yarn workspaces 設定（package.json）
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

**指令語法**：yarn 的指令更簡短直觀。

```bash
# 安裝依賴
npm install        →  yarn
npm install axios  →  yarn add axios
npm install -D eslint  →  yarn add -D eslint

# 執行腳本
npm run build  →  yarn build（可以省略 run）
npm run test   →  yarn test
```

**錯誤訊息**：yarn 的報錯訊息通常比 npm 更清晰，定位問題更容易。

## lockfile 的使用規範

不管用哪個工具，lockfile 都應該提交到 git：

```ini
# .gitignore

# 選一個，不要兩個都用
# npm 專案：提交 package-lock.json
# yarn 專案：提交 yarn.lock

# 不要混用：如果用 yarn，把 package-lock.json 加入 gitignore
package-lock.json
```

團隊裡混用 npm 和 yarn 會導致 lockfile 衝突，強製統一工具版本：

```json
// package.json
{
  "engines": {
    "node": ">=8.0.0",
    "npm": ">=5.0.0"
  }
}
```

## 該選哪個

**選 yarn 的場景：**

- 需要 workspaces（monorepo 專案）
- 團隊習慣了 yarn，遷移成本高
- CI 速度敏感（yarn 快取利用率更高）

**選 npm 5+ 的場景：**

- 新專案，沒有歷史包袱
- 團隊已經在用 npm，升到 5.x 即可
- 不需要 workspaces

**我的建議**：新專案用 npm 5+，除非有明確的 monorepo 需求。npm 是官方工具，跟隨 Node.js 發布，不需要額外安裝，維護成本更低。yarn 的主要優勢已經大幅縮小，隻有 workspaces 是目前的明顯差異。

---

_下一篇：前端模組化：CommonJS 到 ES Module_
