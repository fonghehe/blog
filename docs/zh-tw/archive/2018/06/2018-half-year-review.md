---
title: "2018 上半年：工程化體系建設與 Vue 深入實踐"
date: 2018-06-28 10:43:27
tags:
  - 前端
readingTime: 5
description: "2018 上半年的核心工作圍繞三件事：中後臺系統的架構升級、內部元件庫的從零搭建、以及工程化流水線的完善。這裡做一個系統性的覆盤，記錄技術選型的思考和實際踩過的坑。"
wordCount: 1439
---

2018 上半年的核心工作圍繞三件事：中後臺系統的架構升級、內部元件庫的從零搭建、以及工程化流水線的完善。這裡做一個系統性的覆盤，記錄技術選型的思考和實際踩過的坑。

## H1 重點專案回顧

### 中後臺系統：Webpack 3 到 4 的遷移 + TypeScript 漸進引入

年初接手了一個跑了兩年的中後臺系統，技術棧是 Webpack 3 + Vue 2.3，構建時間穩定在 45 秒左右。當時面臨兩個選擇：一是小修小補繼續維護，二是做一次徹底的工程化升級。考慮到團隊後續要並行維護多箇中後臺專案，我選擇了後者。

**Webpack 4 升級**的核心收益不在版本號，而在於 mode 機制和 Tree Shaking 的最佳化。遷移過程中最大的阻力來自 plugin 生態的相容性——好幾個 Webpack 3 的 plugin 還沒跟上 4.x，需要找替代方案或者自己寫適配。最終構建時間從 45s 降到 12s，主要貢獻來自兩處：

```js
// webpack.config.js 關鍵配置
module.exports = {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

加上 `HardSourceWebpackPlugin` 做持久化快取和路由懶載入，開發環境熱更新體驗好了很多。

**TypeScript 漸進式遷移**是更長期的投入。遺留程式碼裡 `any` 氾濫，不可能一次性改完。採取的策略是：新模組強制 TS，舊模組通過 `allowJs` 逐步覆蓋。到六月底，核心模組的覆蓋率大概在 60%。這個過程中最大的收穫是理解了型別系統不是"限制"，而是一種編譯期的契約文件——特別是多人協作場景下，型別定義本身就是最好的介面說明。

## 元件庫建設

上半年啟動了內部共享元件庫的建設。目標不是造一套新的 UI 框架，而是基於 Element UI 封裝業務層通用元件：許可權按鈕、資料字典選擇器、複雜搜尋表單、通用 CRUD 表格等。

設計上做了幾個關鍵決策：

- **Props 驅動，不侵入業務邏輯**：元件只關心 UI 和資料流，業務邏輯通過 slot 和 event 委託出去
- **TypeScript 型別匯出**：每個元件同時匯出型別定義，使用方有完整的型別提示
- **按需引入**：配合 `babel-plugin-component`，避免全量打包

```ts
// 元件型別匯出示例
export interface CrudTableProps {
  columns: ColumnConfig[];
  fetchApi: (params: QueryParams) => Promise<PaginatedResult<any>>;
  rowKey?: string;
  toolbar?: ToolbarConfig[];
}
```

到六月底，元件庫覆蓋了 3 箇中後臺專案的 70% 通用場景，新專案初始化時間縮短了約 40%。

## 工程化改進

### CI 整合

之前團隊部署靠手動 `npm run build` 然後 scp 到伺服器，風險很高。上半年接入了 GitLab CI，pipeline 包含 lint -> test -> build -> deploy 四個階段。關鍵配置：

```yaml
# .gitlab-ci.yml 核心流程
stages:
  - lint
  - test
  - build
  - deploy

lint:
  stage: lint
  script:
    - npm run lint
    - npm run type-check

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
```

部署環節接了釘釘通知，構建失敗會自動 at 相關開發。上線事故追溯從"誰部署的"變成了"哪個 MR 引入的"。

### 程式碼質量工具鏈

ESLint + Prettier 的組合在團隊落地花了比預期更長的時間——核心矛盾不是規則本身，而是存量程式碼的格式化成本。最終策略是：開啟 `lint-staged` 只對改動檔案做檢查，存量程式碼通過一次批次格式化 PR 統一處理。配合 `commitlint` 規範 commit message，程式碼審查效率提升明顯。

## 踩過的坑

**1. TypeScript 與 Vue 的相容性問題**

Vue 2.x 對 TypeScript 的支援並不完美。`vue-property-decorator` 的裝飾器語法在某些場景下型別推斷會丟失，特別是 mixins 和 provide/inject。最終的解決方案是：mixins 儘量用 composition 的方式替代，provide/inject 顯式宣告型別。

**2. Webpack 4 的 sideEffects 配置**

Tree Shaking 不工作的排查花了半天，最終發現是 `package.json` 裡沒宣告 `sideEffects: false`。加上之後 bundle 體積又減了 15%。這個教訓說明：升級工具鏈不能只改配置檔案，依賴庫的 package.json 同樣需要檢查。

**3. Nuxt.js SSR 的坑**

做內容站 SEO 時用了 Nuxt，`window is not defined` 的問題反覆出現。根本原因是第三方庫在模組頂層訪問了瀏覽器 API。解決方案是用 `process.client` 守衛，或者通過 `require` 在 mounted 階段動態引入。這個坑讓我認識到：SSR 不是換個框架就行，整條依賴鏈都需要適配。

## H2 規劃

**技術深度：**

- TypeScript 高階型別系統：泛型約束、條件型別、模板字面量型別，在元件庫中落地
- React 生態跟進：React 16.7 的 Hooks 特性值得深入，計劃用一個內部專案做技術驗證
- 前端測試體系：目前只有零散的單元測試，目標是搭建元件庫的自動化測試 + CI 整合

**工程體系：**

- 前端監控接入 Sentry，覆蓋錯誤捕獲和效能指標上報
- 微前端調研：中後臺系統越來越多，需要評估 qiankun / single-spa 的可行性
- Docker 化構建環境，統一團隊的 Node 版本和構建依賴

**技術影響力：**

- 在團隊內做 2-3 次技術分享（Webpack 最佳化、TypeScript 實踐）
- 元件庫文件站搭建，降低新人上手成本

## 小結

- 完成了中後臺系統的 Webpack 4 升級和 TypeScript 漸進遷移，構建效率提升 73%
- 啟動了業務元件庫建設，覆蓋 3 個專案的通用場景
- 落地了 GitLab CI 流水線和程式碼質量工具鏈，告別手動部署
- 解決了 Vue + TypeScript 相容性、Webpack Tree Shaking、Nuxt SSR 等實際問題
- H2 重點方向：React 驗證、測試體系、監控體系、微前端調研
