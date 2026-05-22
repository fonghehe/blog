---
title: "發佈一個 npm 包的完整流程：特性解讀與遷移建議"
date: 2019-06-26 09:37:41
tags:
  - Node.js
readingTime: 7
description: "最近把項目中一個通用的工具函數抽成了 npm 包，完整走了一遍從初始化到發佈的流程。記錄下來，方便以後查閲，也希望能幫到有同樣需求的同學。"
wordCount: 1617
---

最近把項目中一個通用的工具函數抽成了 npm 包，完整走了一遍從初始化到發佈的流程。記錄下來，方便以後查閲，也希望能幫到有同樣需求的同學。

## 初始化項目

創建一個新目錄，然後執行 `npm init`：

```bash
mkdir my-awesome-utils
cd my-awesome-utils
npm init
```

`npm init` 會引導你填寫一系列信息，生成 `package.json`。這裏重點説幾個關鍵字段。

## package.json 關鍵字段

```json
{
  "name": "my-awesome-utils",
  "version": "1.0.0",
  "description": "A collection of utility functions for frontend development",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "rollup -c",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test",
    "lint": "eslint src/"
  },
  "keywords": [
    "utils",
    "frontend",
    "javascript"
  ],
  "author": "fonghehe",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/fonghehe/my-awesome-utils.git"
  },
  "devDependencies": {
    "rollup": "^1.15.0",
    "jest": "^24.8.0"
  }
}
```

逐個解釋：

- **`main`**：CommonJS 入口，`require('my-awesome-utils')` 會加載這個文件
- **`module`**：ES Module 入口，Webpack、Rollup 等打包工具會優先讀取這個字段，支持 tree-shaking。這不是 npm 官方字段，但已是社區事實標準
- **`types`**：TypeScript 類型聲明文件的入口，`tsc` 和 IDE 會根據這個字段提供類型提示
- **`files`**：指定發佈到 npm 時包含哪些文件。沒有這個字段，npm 會發布整個目錄（除了 `.npmignore` 排除的）
- **`description`**：會顯示在 npm 搜索結果中，寫清楚便於搜索
- **`keywords`**：同樣用於 npm 搜索，儘量覆蓋用户可能搜索的關鍵詞
- **`repository`**：npm 頁面上會顯示倉庫鏈接，方便用户提 issue
- **`license`**：不寫的話每次 `npm publish` 都會警告，開源項目一般選 MIT
- **`prepublishOnly`**：發佈前自動執行的鈎子，確保發佈前代碼是構建好的、測試通過的

## .npmignore vs files 字段

控製發佈內容有兩種方式：

**方式一：`files` 字段（推薦）**

```json
{
  "files": [
    "dist",
    "src"
  ]
}
```

白名單模式，隻發布 `files` 中列出的檔案。簡潔明確，不容易出錯。注意 `package.json`、`README.md`、`LICENSE` 和 `CHANGELOG` 始終會被包含，不需要顯式列出。

**方式二：`.npmignore`**

```bash
# .npmignore
src/
test/
.eslintrc.js
jest.config.js
*.test.js
coverage/
.travis.yml
.editorconfig
```

黑名單模式，排除你不想要的檔案。注意幾個細節：

1. `.npmignore` 會覆蓋 `.gitignore`。也就是説，如果 `.gitignore` 裏排除了 `node_modules/` 但 `.npmignore` 裏沒有寫，那 `node_modules/` 就會被髮布出去——這很危險
2. 如果沒有 `.npmignore`，npm 會使用 `.gitignore` 作為兜底
3. 和 `.gitignore` 語法一致，支持通配符和目錄匹配

**對比總結**：

| | `files` 字段 | `.npmignore` |
|
---|---|---|
| 模式 | 白名單 | 黑名單 |
| 安全性 | 高，不會意外發布 | 需要持續維護 |
| 可見性 | 在 package.json 中 | 單獨文件 |
| 推薦場景 | 絕大多數情況 | 需要精細控製時 |

推薦用 `files` 字段，原因很簡單：白名單更安全，且不需要維護額外的檔案。

## 構建設定（Rollup 示例）

既然提到了 `module` 字段，就需要同時輸出 CJS 和 ESM 兩種格式。用 Rollup 比較方便：

```javascript
// rollup.config.js
export default [
  // CommonJS 輸出
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    }
  },
  // ES Module 輸出
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.esm.js',
      format: 'es'
    }
  }
];
```

這樣消費者可以根據自己的打包工具選擇合適的格式：

```javascript
// CommonJS 環境
const utils = require('my-awesome-utils')

// ES Module 環境（Webpack/Rollup 會自動選擇 module 字段）
import { debounce, throttle } from 'my-awesome-utils'
```

為什麼要同時輸出兩種格式？因為 Webpack 4+ 在解析到 `module` 字段時，會利用 ES Module 的靜態分析能力做 tree-shaking，最終打包體積更小。而 Node.js 的 `require` 仍然走 CommonJS。

## 添加 TypeScript 類型聲明

即使你的源碼不是 TypeScript，也應該提供類型聲明。這對使用 TypeScript 的團隊來説是剛需，IDE 也能據此提供更好的自動補全。

**方式一：手寫 `.d.ts` 文件**

如果源碼是 JavaScript，可以單獨寫一個類型聲明文件：

```typescript
// src/index.d.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void;

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void;

export function deepClone<T>(obj: T): T;

export function formatDate(date: Date, format: string): string;
```

**方式二：用 TypeScript 編寫源碼，自動編譯出聲明**

```json
// tsconfig.json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "dist",
    "outDir": "dist",
    "moduleResolution": "node",
    "strict": true
  },
  "include": ["src"]
}
```

配置好 `declaration: true` 後，`tsc` 會自動為每個 `.ts` 文件生成對應的 `.d.ts` 文件。然後 `package.json` 中的 `"types": "dist/index.d.ts"` 指向它即可。

**驗證類型聲明是否生效**：

```bash
# 在另一個項目中本地鏈接測試
cd my-awesome-utils
npm link

cd ../another-project
npm link my-awesome-utils

# 然後看 IDE 是否能正確提示類型
```

## Scoped Packages

如果包名和別人的衝突了，或者想把所有包歸到自己的命名空間下，可以用 scoped package：

```json
{
  "name": "@fonghehe/my-awesome-utils"
}
```

scoped 包默認是私有的，要發佈為公開包需要加 `--access public`：

```bash
npm publish --access public
```

在團隊內部很有用，比如 `@company/shared-utils`、`@company/ui-components` 這樣的命名。安裝時需要帶上 scope：

```bash
npm install @fonghehe/my-awesome-utils
```

## 語義化版本（SemVer）

npm 遵循語義化版本規範：`主版本號.次版本號.修訂號`（MAJOR.MINOR.PATCH）

```
1.0.0 → 1.0.1  修 bug（PATCH）
1.0.0 → 1.1.0  新增功能，向後兼容（MINOR）
1.0.0 → 2.0.0  破壞性變更（MAJOR）
```

發佈時用 `npm version` 命令自動修改版本號並創建 git tag：

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

**預發佈版本**：

```bash
npm version prerelease --preid=beta  # 1.0.0 → 1.0.1-beta.0
npm publish --tag beta               # 發佈到 beta 標籤
```

用户可以通過 `npm install my-awesome-utils@beta` 安裝預發佈版本。

`npm version` 還會自動創建 git tag，方便回溯每個版本對應的代碼。

## npm publish 完整流程

```bash
# 1. 確保代碼是最新的
git pull origin master

# 2. 登錄（如果還沒登錄）
npm login

# 3. 檢查將要發佈的檔案
npm pack --dry-run

# 4. 更新版本號（會自動創建 git tag）
npm version patch

# 5. 發佈（prepublishOnly 鈎子會自動執行 build 和 test）
npm publish

# 6. 推送 git tag
git push origin master --tags
```

`npm pack --dry-run` 非常有用，它會列出所有將被打包發佈的文件及其大小，發佈前務必檢查一遍：

```bash
$ npm pack --dry-run
npm notice === Tarball Contents ===
npm notice 2.1kB  dist/index.js
npm notice 1.8kB  dist/index.esm.js
npm notice 0.4kB  dist/index.d.ts
npm notice 1.2kB  README.md
npm notice 1.1kB  LICENSE
npm notice === Tarball Details ===
npm notice name:          my-awesome-utils
npm notice version:       1.0.1
npm notice filename:      my-awesome-utils-1.0.1.tgz
npm notice package size:  2.3 kB
```

確認沒有包含不該發佈的文件（比如 `.env`、`node_modules`、測試文件等）。

## npm scripts 實用技巧

```json
{
  "scripts": {
    "dev": "rollup -c -w",
    "build": "rollup -c",
    "test": "jest --coverage",
    "lint": "eslint src/ --fix",
    "prepublishOnly": "npm run lint && npm run test && npm run build",
    "postversion": "git push origin master --tags"
  }
}
```

幾個生命週期鈎子的執行順序：

1. `prepublishOnly` —— 發佈前執行，最後的安全關卡
2. `prepack` / `postpack` —— 打包前後執行
3. `preversion` / `postversion` —— 修改版本號前後執行

`prepublishOnly` 是最關鍵的鈎子，它確保了：代碼風格檢查不過 → 不發佈；測試不過 → 不發佈；構建失敗 → 不發佈。

## README 怎麼寫

README 是用户瞭解你包的第一入口，至少包含以下內容：

- 一句話説明這個包是幹什麼的
- 安裝命令
- 最小可用示例（讓用户 30 秒內跑起來）
- 完整的 API 文檔
- License

```markdown
# my-awesome-utils

> 前端常用工具函數集合

## 安裝

\`\`\`bash
npm install my-awesome-utils
# 或
yarn add my-awesome-utils
\`\`\`

## 使用

\`\`\`javascript
import { debounce, throttle, deepClone } from 'my-awesome-utils'

// 防抖：300ms 內多次觸發隻執行最後一次
const handleSearch = debounce((keyword) => {
  fetchSearchResults(keyword)
}, 300)

// 節流：每 200ms 最多執行一次
const handleScroll = throttle(() => {
  updateScrollPosition()
}, 200)

// 深拷貝
const newObj = deepClone({ a: { b: 1 } })
\`\`\`

## API

### debounce(fn, wait)
防抖函數，返回一個防抖後的函數。

### throttle(fn, wait)
節流函數，返回一個節流後的函數。

### deepClone(obj)
深拷貝，支持對象、數組、Date、RegExp 等類型。
```

寫 README 的一個技巧：從一個新手的視角出發，假設他完全不瞭解你的包，能否在不看源碼的情況下用起來。

## 撤銷發佈（unpublish）

如果剛發佈的包有嚴重問題：

```bash
# 撤銷指定版本（發佈後 72 小時內，且沒有其他包依賴）
npm unpublish my-awesome-utils@1.0.1

# 強製撤銷（不推薦）
npm unpublish my-awesome-utils@1.0.1 --force

# 廢棄某個版本（比 unpublish 更温和，用户安裝時會收到警告）
npm deprecate my-awesome-utils@1.0.1 "請升級到 1.0.2，此版本有嚴重 bug"

# 廢棄整個包的所有版本
npm deprecate my-awesome-utils "此包已遷移到 @fonghehe/utils，請更新依賴"
```

關鍵區別：

- `npm unpublish`：從 registry 徹底刪除，其他依賴它的項目會安裝失敗。npm 有 72 小時限製，且如果有人依賴了你的包則不允許 unpublish
- `npm deprecate`：包還在，隻是安裝時會顯示警告。對已有用户更友好

**最佳實踐**：不要 unpublish，而是 deprecate + 發佈修復版本。unpublish 會破壞其他項目的構建，尤其是你的包被間接依賴時。

## 小結

- `package.json` 中 `main`、`module`、`types` 三個字段分別對應 CJS 入口、ESM 入口和類型聲明，打包工具會按需讀取
- 用 `files` 字段白名單控製發佈內容，比 `.npmignore` 更安全
- TypeScript 類型聲明對 TS 用户是剛需，即使源碼是 JS 也應該提供
- `npm pack --dry-run` 發佈前檢查打包內容，避免泄露敏感文件
- 遵循語義化版本，用 `npm version` 自動管理版本號和 git tag
- `prepublishOnly` 鈎子確保發佈前自動執行 lint、test、build，防止發佈有問題的代碼
- unpublish 是最後手段，優先用 deprecate + 修復版本處理問題
