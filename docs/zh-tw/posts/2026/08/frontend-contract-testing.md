---
title: "前端契約測試：用 Consumer-Driven Contract 終結 API 漂移"
date: 2026-08-25 09:26:47
tags:
  - 測試
readingTime: 8
description: "當 mock 單元測試和手動整合測試反覆漏掉後端介面變更時，Consumer-Driven Contract Testing 把契約定義權交給前端。本文從 Pact 和 OpenAPI 兩條路線出發，記錄一個 4 前端共享 BFF 團隊的落地過程、踩坑與收益。"
wordCount: 1902
---

我們團隊有四個前端應用（管理後台、C 端 H5、小程式、營運工具）共用一套 BFF。過去兩年裡，線上事故中大約有三分之一是「前端以為欄位還在，後端已經改了」造成的。Mock 資料寫死在單元測試裡，跑過；整合測試靠人工點對接文件，也過了；上線才發現白屏。問題不是測試不夠多，而是測試驗證的東西和真實契約不一致。

Consumer-Driven Contract Testing（CDCT）的核心思路是把契約的定義權從後端挪到前端——誰消費 API，誰來聲明期望的互動格式，後端在 CI 中驗證自己是否滿足這些期望。這不是替代現有測試，而是在單元測試和 E2E 之間補一層專門抓介面漂移的安全網。

## 為什麼 Mock 和手動對接不夠用

Mock 的問題不在於它假，而在於它不會自動更新。後端把 `user.avatar` 改成 `user.avatarUrl`，前端的 mock 檔案沒人改，單元測試照樣綠。等聯調或上線才暴露。

手動對接依賴人記得去查文件、比對欄位。四個前端各自維護一份心智模型，BFF 每次發版要通知四撥人。漏掉任何一個就是事故。

| 偵測手段 | 能抓到什麼 | 抓不到什麼 |
|---------|-----------|-----------|
| Mock 單元測試 | 元件邏輯、狀態流轉 | API 結構變更、欄位重新命名 |
| 手動聯調 | 當前版本的相容問題 | 下一次發布的破壞性變更 |
| E2E 測試 | 完整使用者流程 | 非核心路徑的介面變更 |
| 契約測試 | 介面結構、欄位類型、必填項變更 | 業務邏輯錯誤 |

契約測試填補的是「介面結構一致性」這個特定缺口。它不驗證業務對不對，只驗證雙方對資料格式的約定有沒有被打破。

## Pact：Consumer 定義契約，Provider 驗證

Pact 是 CDCT 最成熟的實作。工作流程分三步：

1. **Consumer 端**編寫互動期望，產生 pact 檔案
2. **Pact Broker**儲存和版本化契約
3. **Provider 端**在 CI 中拉取契約並驗證

```typescript
// consumer: 前端訂單列表頁的契約
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'admin-dashboard',
  provider: 'bff-order-service',
});

describe('GET /api/orders', () => {
  it('返回分頁訂單列表', async () => {
    const { like, eachLike, integer, string } = MatchersV3;

    await provider
      .given('存在 3 筆訂單')
      .uponReceiving('取得訂單列表請求')
      .withRequest({
        method: 'GET',
        path: '/api/orders',
        query: { page: '1', pageSize: '20' },
      })
      .willRespondWith({
        status: 200,
        body: {
          total: integer(3),
          items: eachLike({
            id: string('ORD-20260801-001'),
            status: string('confirmed'),
            amount: like(9900),           // 金額單位為分
            createdAt: string('2026-08-01T10:00:00Z'),
            buyer: {
              name: string('張三'),
              phone: string('138****1234'),
            },
          }),
        },
      });

    // 執行實際請求，驗證回應匹配契約
    const interaction = await provider.executeTest(async (mockserver) => {
      const res = await fetch(`${mockserver.url}/api/orders?page=1&pageSize=20`);
      return res.json();
    });

    expect(interaction.items).toHaveLength(3);
    expect(typeof interaction.items[0].amount).toBe('number');
  });
});
```

這段程式碼的關鍵不在斷言本身，而在 `willRespondWith` 裡的 matcher。`like(9900)` 表示「這裡是個數字就行」，`string('ORD-...')` 表示「字串格式」。Pact 產生的契約檔案描述的是結構約束而非精確值，所以後端只要保持結構一致就能通過驗證，不需要返回一模一樣的資料。

Provider 端的驗證通常在 Node.js 或 JVM 測試套件中執行：

```typescript
// provider: BFF 端驗證契約
import { Verifier } from '@pact-foundation/pact';

describe('bff-order-service 契約驗證', () => {
  it('滿足 admin-dashboard 的契約', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3000',
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      provider: 'bff-order-service',
      consumerVersionSelectors: [
        { branch: 'main' },
        { deployedOrReleased: true },
      ],
      publishVerificationResult: true,
      providerVersion: process.env.GIT_SHA,
    });

    await verifier.verifyProvider();
  });
});
```

CI 流水線中的順序是：Consumer PR → 產生 pact → 上傳 Broker → Provider main 分支定時驗證 + Provider PR 觸發 can-i-deploy 檢查。如果 Provider 改動破壞了某個 Consumer 的契約，PR 直接標紅。

## OpenAPI 契約：Schema 驅動的另一條路

Pact 的優勢是細粒度、consumer-driven，劣勢是需要引入 Broker 基礎設施和學習成本。對於已有 OpenAPI spec 的團隊，用 schema validator 做契約檢查是一條更輕量的路線。

```typescript
// 基於 OpenAPI spec 的請求/回應校驗中介軟體
import openapiValidator from 'express-openapi-validator';
import swaggerParser from '@apidevtools/swagger-parser';

async function setupContractValidation(app: Express.Application) {
  const spec = await swaggerParser.validate('./openapi/bff-order.yaml');

  app.use(
    openapiValidator.middleware({
      apiSpec: spec,
      validateRequests: true,   // 校驗入參是否符合 spec
      validateResponses: true,  // 校驗出參是否符合 spec
      validateSecurity: false,
    }),
  );

  // 回應不符合 spec 時自動返回 500 + 詳細錯誤
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.status && err.errors) {
      console.error('[Contract Violation]', {
        path: req.path,
        method: req.method,
        errors: err.errors,
      });
      res.status(500).json({
        error: 'SERVER_CONTRACT_VIOLATION',
        details: err.errors,
      });
    } else {
      next(err);
    }
  });
}
```

這種方式的好處是契約即文件，spec 本身就是前後端共享的真相源。缺點是它是 provider-centric 的——spec 由後端維護，前端只是被動消費者。當四個前端的需求不一致時，spec 容易變成最小公約數，覆蓋不到某些 Consumer 真正依賴的欄位。

我的建議是兩條路結合：核心介面用 OpenAPI spec 做基礎校驗，關鍵的 Consumer 特定需求用 Pact 補充。

## 在一個 4 前端 + 1 BFF 的團隊中落地

我們的落地分了三個階段：

**第一階段：選一個痛點最大的介面試水。** 選了訂單列表——四個前端都用，欄位變更最頻繁。只用 Pact，只在 admin-dashboard 這一個 Consumer 上寫契約。兩週後第一次抓到破壞性變更：BFF 把 `buyer.phone` 從可選改為刪除（因為隱私合規），但沒通知 C 端 H5 還在展示手機號脫敏。契約測試在 Provider CI 裡紅了，修复合約後才合併。

**第二階段：擴展到其他 Consumer。** 每個前端應用各自為關鍵介面寫契約。建立了規範：只為核心業務流程（下單、支付、退款、使用者資訊）寫契約，不為內部工具類介面寫。契約數量控制在 40 個左右，維護成本可控。

**第三階段：OpenAPI spec 作為基線。** BFF 團隊開始維護 OpenAPI spec，所有新介面必須先寫 spec 再開發。spec 校驗放在 BFF 的整合測試裡，Pact 繼續保留用於 Consumer 特定的細粒度約束。

落地的阻力主要來自兩方面。一是前端同事覺得「又要寫一種測試」，解決方案是把契約測試的編寫樣板化，提供一個腳手架命令直接產生骨架程式碼。二是 BFF 團隊擔心契約太多會拖慢發布節奏，解決方案是區分 breaking 和 non-breaking：新增欄位不觸發失敗（向後相容），只有刪除欄位、改類型、改必填才阻斷。

## 契約測試抓到的典型問題

上線三個月，契約測試攔截了十幾次破壞性變更，舉幾個典型的：

- **欄位重新命名未同步**：`orderStatus` → `status`，三個 Consumer 的契約同時紅了
- **返回值類型變更**：`amount` 從 number 變成 string（後端序列化框架升級導致），Pact matcher 立刻報錯
- **巢狀結構拍平**：`buyer.name` 被提升到頂層 `buyerName`，Consumer 還在讀 `item.buyer.name`
- **列舉值刪除**：訂單狀態的 `cancelled` 被移除，替換為 `refunded`，C 端的狀態映射表缺了這個 case
- **分頁參數語意變更**：`page` 從 0-based 改成 1-based，沒有文件說明

這些問題的共同點是：單元測試不會發現（mock 還是舊的），E2E 不一定覆蓋（非核心路徑），只有契約測試能在程式碼合併前攔住。

## 什麼時候不該用契約測試

契約測試不是萬能的。以下場景用它反而是負擔：

- **內部微服務之間的呼叫**：如果兩個服務的部署節奏完全同步且同屬一個團隊，直接整合測試更高效
- **第三方 API**：你沒法讓對方跑你的契約驗證，只能用本機 mock + 定期冒煙測試
- **高度動態的介面**：GraphQL 的 flexible query 很難用傳統契約描述，更適合 schema introspection + persisted queries
- **原型階段**：介面每天都在變，寫契約等於每天重寫，等產品穩定後再引入

判斷標準很簡單：如果兩個團隊的發布節奏獨立，且介面變更的歷史頻率高於每月一次，契約測試就值得投入。

## 小結

契約測試解決的是一個具體的工程問題：前後端獨立演進時，如何低成本地保證介面一致性。它不替代單元測試和 E2E，而是在兩者之間補了一層針對 API 結構的防護。Pact 適合 Consumer 驅動的精細化契約，OpenAPI validator 適合 spec 驅動的基線校驗，兩者可以組合使用。落地時從一個痛點介面切入，逐步擴展，避免一開始就追求全覆蓋。最終衡量標準不是契約數量，而是它實際攔住了多少次本該上線的介面漂移。
