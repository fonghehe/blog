---
title: "原生 TypeScript 編譯器 tsgo 遷移實戰：Monorepo 從 tsc 到 Go 編譯器的完整記錄"
date: 2026-08-11 09:47:12
tags:
  - TypeScript
readingTime: 8
description: "將一個中型 Monorepo 從 tsc 遷移到 Go 原生編譯器 tsgo 的完整過程：哪些場景真的變快了、設定和 API 層面的破壞性變更、CI 流水線調整、回退策略，以及一份可直接複用的遷移清單。"
wordCount: 3400
---

TypeScript 7.x 系列發布後，社群討論最多的不是型別系統的新特性，而是那個用 Go 重寫的原生編譯器 tsgo。微軟在 TypeScript 7.0 中正式將 tsgo 作為可選編譯器後端提供，目標是將大型專案的型別檢查速度提升一個數量級。我在團隊的一個中型 Monorepo（約 40 萬行 TS/TSX，12 個 packages）上完成了從 tsc 到 tsgo 的遷移，這篇文章記錄了真實過程中遇到的加速、阻礙和取捨。

## 什麼變快了，什麼沒有

先說結論：tsgo 的型別檢查確實快，但它不是所有場景的銀彈。

| 操作 | tsc 耗時 | tsgo 耗時 | 提速比 |
|------|---------|----------|--------|
| 全量型別檢查（`--noEmit`） | 48s | 6.2s | ~7.7x |
| 增量型別檢查（單檔案修改） | 3.8s | 0.4s | ~9.5x |
| 全量 emit（產生 .js + .d.ts） | 52s | 48s | ~1.1x |
| IDE 開啟專案首次載入 | 12s | 2.1s | ~5.7x |
| IDE 編輯時診斷延遲 | 800ms | 90ms | ~8.9x |

型別檢查和編輯器體驗的提升是顯著的——這正是 tsgo 的設計重心。Go 實作的編譯器利用了平行處理型別檢查和更高效的記憶體配置，在大規模程式碼庫上的優勢尤其明顯。

但 emit（程式碼產生）階段幾乎沒有提速。tsgo 目前只替換了型別檢查管線，emit 仍然走原有的 TypeScript 編譯器邏輯。如果你的瓶頸是建構產物產生而非型別檢查，tsgo 不會帶來明顯改善。我們的生產建構使用 esbuild/Rolldown 做 emit，tsc/tsgo 僅用於型別驗證，所以這個限制對我們影響不大。

## 設定與 API 層面的破壞性變更

遷移不是改個命令列參數就完事的。tsgo 對部分 tsconfig 選項和 Compiler API 的支援存在差異。

### Module Resolution 的邊緣情況

我們專案中有一個內部 packages 引用鏈，使用了 `paths` + `baseUrl` + `exports` 三層映射的組合。tsc 能正確解析，但 tsgo 在以下場景中表現不同：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"],
      "@app/utils": ["packages/utils/src/index.ts"] // 精確映射
    }
  }
}
```

問題出在精確路徑映射（不帶萬用字元）與 `exports` 欄位的優先順序上。tsc 會先匹配 `paths` 中的精確映射，再 fallback 到 package.json 的 `exports`；tsgo 在某些情況下優先走了 `exports` 解析，導致指向了編譯後的 `.d.ts` 而非原始碼。

解決方案是在 tsconfig 中明確指定 `customConditions`，確保 tsgo 走到正確的解析分支：

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

同時在被引用的 package.json 中新增對應的 condition：

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

### Transformer 外掛不相容

這是遷移中最大的阻礙。我們之前使用了兩個自訂 transformer：

1. `typescript-transform-paths`：編譯時將絕對路徑重寫為相對路徑
2. `ts-nameof`：編譯時提取變數名稱用於日誌

tsgo 不支援 TypeScript Compiler API 中的 `createProgram` + custom transformers 介面。它有自己的 Program API，但表面積極小，無法注入自訂轉換步驟。

對於 `typescript-transform-paths`，我們改用建構工具層面解決——Rolldown/esbuild 本身就能處理路徑別名，不需要編譯器介入。

對於 `ts-nameof`，我們在遷移前將其替換為手動字串常數。這是一個權衡：失去了編譯時自動提取的便利，但消除了對非標準編譯器擴充套件的依賴。

### Program API 的限制

如果你有基於 `ts.createProgram` 的自訂工具（如程式碼產生器、文件提取器），需要注意 tsgo 的 Program API 是一個精簡子集。以下 API 在 tsgo 中不可用或行為不同：

- `program.getTypeChecker()` — 可用，但返回的 TypeChecker 缺少部分進階方法（如 `getSymbolAtLocation` 在某些節點類型上不工作）
- `program.getSourceFiles()` — 可用
- `typeChecker.getWidenedLiteralType()` — 不可用
- 自訂 `CompilerHost` — 不支援

我們的內部 API 文件產生工具依賴了這些 API，遷移後改為使用 `ts-morph`（它仍然綁定 tsc）獨立執行，不與 tsgo 共享處理程序。

## CI 流水線的改造

遷移前我們的 CI typecheck 步驟：

```yaml
# 舊設定
- name: Type Check
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

遷移後：

```yaml
# 新設定
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

關鍵的改動是保留了 tsc 作為 fallback。在遷移的前三個月裡，tsgo 偶爾會在某些邊緣語法上回報誤報（false positive），此時 CI 會自動回退到 tsc 驗證，避免阻塞合併流程。我們同時會將誤報案例提交給 TypeScript 團隊的 issue tracker。

實際效果：CI 中 typecheck 步驟的平均耗時從 48 秒降到 7 秒（包含 tsgo 安裝時間約 1 秒）。對於一個日均 30+ PR 的團隊，這意味著每天節省約 20 分鐘的 CI 等待時間。

我們還加了一個雙跑對比階段，在遷移初期同時執行 tsc 和 tsgo，比對兩者的診斷輸出是否一致：

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

這個指令碼在遷移的第一個月作為 CI 必跑步驟，確認兩者輸出穩定一致後才降級為可選手動觸發。

## 回退策略

遷移 tsgo 是可逆的，但需要提前規劃好回退路徑：

1. **保留 tsc 依賴**：不要從 devDependencies 中移除 typescript 套件。tsgo 是獨立安裝的，兩者可以共存
2. **tsconfig 相容性**：保持一份 `tsconfig.tsc.json` 作為 tsc 專用設定，當需要回退時使用 `-p tsconfig.tsc.json`
3. **CI 開關**：透過環境變數控制使用哪個編譯器，而非硬編碼

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

4. **IDE 設定**：VS Code 的 TypeScript 外掛支援選擇編譯器版本。在 `.vscode/settings.json` 中指定：

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "./node_modules/@typescript/native-tsgo/lib"
}
```

回退時只需改回 `"./node_modules/typescript/lib"`。

## 哪些專案應該等一等

不是所有專案都適合現在遷移。根據我的經驗，以下情況建議觀望：

**應該等的：**
- 使用了自訂 transformer 外掛且無法替代的專案
- 依賴 `ts.createProgram` API 建構內部工具的 monorepo
- tsconfig 中大量使用 `paths` + `rootDirs` + `composite` 組合的複雜設定
- 對 TypeScript 最新語法特性的前沿使用者（tsgo 對新語法的跟進通常晚於 tsc 1-2 個 minor 版本）

**可以放心遷移的：**
- 以型別檢查為主要用途（`--noEmit`），emit 由其他工具負責
- 標準 ESM/CJS 模組解析，無複雜的 path mapping
- 純業務程式碼專案，不依賴編譯器擴充套件
- 大型 monorepo，型別檢查耗時已成為開發體驗瓶頸

## 遷移清單

以下是我整理的可直接複用的遷移步驟：

```markdown
## tsgo 遷移清單

### 前置檢查
- [ ] 確認不使用自訂 transformer（或已有替代方案）
- [ ] 確認不依賴 tsc-only Compiler API
- [ ] 備份當前 tsconfig.json
- [ ] 建立 tsconfig.tsc.json 作為回退設定

### 安裝與設定
- [ ] 安裝 @typescript/native-tsgo
- [ ] 驗證 tsgo --version 正常輸出
- [ ] 執行 tsgo --noEmit 檢查是否有誤報
- [ ] 修復 module resolution 差異（如有）
- [ ] 設定 IDE 使用 tsgo

### CI 整合
- [ ] 新增 tsgo 安裝步驟
- [ ] 替換 typecheck 命令
- [ ] 新增 tsc fallback 邏輯
- [ ] 執行雙跑對比指令碼（至少兩週）
- [ ] 確認診斷輸出一致後移除雙跑

### 驗證與監控
- [ ] 對比遷移前後 CI typecheck 耗時
- [ ] 收集團隊成員 IDE 體驗回饋
- [ ] 追蹤 TypeScript release notes 中的 tsgo 修復
- [ ] 一個月後評估是否完全切換
```

## 展望

tsgo 代表了 TypeScript 工程化的一個重要方向：將開發者日常最頻繁的操作（型別檢查、編輯器回應）做到極致效能，同時保持生態相容。當前的限制（emit 未加速、API 不完整）是階段性問題，TypeScript 團隊已經明確了後續路線圖。

對於大多數前端團隊來說，現在是一個合理的遷移窗口——前提是你清楚自己的專案在哪些方面會受益、哪些方面可能踩坑。不要為了追新而遷移，也不要因為保守而錯過真實的效率提升。先用清單評估，再用資料決策。
