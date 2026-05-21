---
title: "npm vs yarn：2018 年嘅選擇"
date: 2018-01-20 11:10:29
tags:
  - Node.js
readingTime: 3
description: "yarn 喺 2016 年 10 月由 Facebook 發布，當時針對 npm 3 嘅痛點做咗大量改進。兩年過去咗，npm 都推出咗 npm 5，兩者嘅差距縮細咗。呢篇文章傾下 2018 年初呢兩個工具嘅實際差異。"
wordCount: 716
---

yarn 喺 2016 年 10 月由 Facebook 發布，當時針對 npm 3 嘅痛點做咗大量改進。兩年過去咗，npm 都推出咗 npm 5，兩者嘅差距縮細咗。呢篇文章傾下 2018 年初呢兩個工具嘅實際差異。

## yarn 當初解決咗咩問題

yarn 剛出嚟時，相比 npm 3 有三個明顯優勢：

**1. 速度**：yarn 引入咗本地緩存，同一個包第二次安裝幾乎係瞬間完成。npm 3 冇可靠嘅緩存機制，每次都要走網絡。

**2. lockfile**：yarn 生成 `yarn.lock`，精確鎖定所有依賴嘅版本（包括間接依賴）。npm 3 嘅 `npm-shrinkwrap.json` 需要手動運行命令生成，好多團隊冇養成呢個習慣，導致「喺我機器上能跑」嘅問題頻頻出現。

**3. 確定性安裝**：相同嘅 `yarn.lock` 喺唔同機器上安裝嘅 `node_modules` 結構完全一致。npm 3 嘅安裝結果可能因為網絡或時機唔同而有差異。

## npm 5 嘅追趕

2017 年 5 月，npm 5 隨 Node.js 8 發布，補上咗好多不足：

- **`package-lock.json`**：類似 `yarn.lock`，自動生成，精確鎖定版本
- **緩存改進**：使用 `~/.npm` 作為緩存目錄，速度大幅提升
- **安裝速度**：接近 yarn，部分場景更快

現在 npm 5 同 yarn 喺功能上差異已經好細咗。

## 2018 年實測對比

喺一個中等規模項目（約 200 個依賴）上嘅實測：

| 操作                 | npm 5.6 | yarn 1.3 |
| 
-------------------- | ------- | -------- |
| 全新安裝（無緩存）   | 45s     | 42s      |
| 全新安裝（有緩存）   | 22s     | 12s      |
| 增量安裝（只裝新包） | 8s      | 5s       |
| `node_modules` 大小  | 312MB   | 298MB    |

yarn 仍然略快，但差距唔再似兩年前咁懸殊。

## 實際使用中嘅差異

**工作區（Workspaces）**：yarn 1.0 引入咗 workspaces，適合 monorepo 項目管理多個包。npm 目前（5.x）仲唔支援，呢個係現在最大嘅功能差距。

```json
// yarn workspaces 配置（package.json）
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

**命令語法**：yarn 嘅命令更簡短直觀。

```bash
# 安裝依賴
npm install        →  yarn
npm install axios  →  yarn add axios
npm install -D eslint  →  yarn add -D eslint

# 運行腳本
npm run build  →  yarn build（可以省略 run）
npm run test   →  yarn test
```

**錯誤信息**：yarn 嘅報錯信息通常比 npm 更清晰，定位問題更容易。

## lockfile 嘅使用規範

唔管用邊個工具，lockfile 都應該提交到 git：

```ini
# .gitignore

# 揀一個，唔好兩個都用
# npm 項目：提交 package-lock.json
# yarn 項目：提交 yarn.lock

# 唔好混用：如果用 yarn，將 package-lock.json 加入 gitignore
package-lock.json
```

團隊裡面混用 npm 同 yarn 會導致 lockfile 衝突，強制統一工具版本：

```json
// package.json
{
  "engines": {
    "node": ">=8.0.0",
    "npm": ">=5.0.0"
  }
}
```

## 應該揀邊個

**揀 yarn 嘅場景：**

- 需要 workspaces（monorepo 項目）
- 團隊習慣咗 yarn，遷移成本高
- CI 速度敏感（yarn 緩存利用率更高）

**揀 npm 5+ 嘅場景：**

- 新項目，冇歷史包袱
- 團隊已經喺用 npm，升到 5.x 就可以
- 唔需要 workspaces

**我嘅建議**：新項目用 npm 5+，除非有明確嘅 monorepo 需求。npm 係官方工具，跟隨 Node.js 發布，唔需要額外安裝，維護成本更低。yarn 嘅主要優勢已經大幅縮小，只有 workspaces 係目前嘅明顯差異。

---

_下一篇：前端模塊化：CommonJS 到 ES Module_
