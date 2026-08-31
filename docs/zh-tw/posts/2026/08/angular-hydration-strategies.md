---
title: "Angular 23 Hydration 進階：增量水合與 Zoneless 實戰"
date: 2026-08-27 16:48:05
tags:
  - Angular
readingTime: 8
description: "Angular 23 的 hydration 不再只是全量啟用。本文從 @defer hydrate 觸發器、選擇性水合邊界、zoneless 配合、TBT/INP 度量到內容頁與儀表板的不同策略，記錄一個行銷站遷移的真實資料和踩坑經驗。"
wordCount: 1984
---

Angular 17 引入 SSR hydration，解決了長期以來的 re-render flicker 問題。但預設的全量水合對內容型頁面來說太重了——一個行銷落地頁有 20 個元件，使用者可見區域只有首屏 3 個，剩下 17 個在背景默默消耗主執行緒做 hydration，拖慢 TBT 和 INP。Angular 23 的 incremental hydration 讓這件事有了精細控制的可能。

我們剛把一個日均 PV 50 萬的行銷站從 Angular 21 全量水合遷移到 23 的增量水合 + zoneless。這篇文章記錄過程中的決策、資料和踩過的坑。

## Incremental Hydration 的核心機制

Angular 23 把 `@defer` 和 hydration 打通了。以前 `@defer` 只控制客戶端渲染時機（lazy load），伺服器端渲染時所有 defer 塊仍然會完整輸出 HTML。現在你可以指定 defer 塊的 hydration 觸發條件：

```html
<!-- 可見時才水合 -->
@defer (hydrate on visible) {
  <product-recommendations />
}

<!-- 使用者互動時才水合 -->
@defer (hydrate on interaction) {
  <comment-section />
}

<!-- 空閒時水合 -->
@defer (hydrate on idle) {
  <related-articles />
}

<!-- 自訂條件 -->
@defer (hydrate when shouldHydrateMap()) {
  <interactive-map [data]="mapData()" />
}
```

關鍵區別在於：沒有寫 `hydrate` 的 `@defer` 塊在伺服器端渲染時**不會輸出 HTML**（純客戶端懶載入）；寫了 `hydrate on ...` 的塊在伺服器端會完整渲染 HTML，但客戶端只在滿足觸發條件後才啟用事件綁定和變更偵測。這意味著使用者可以立即看到內容，但不必為不可見區域的互動能力付出 JS 執行成本。

四種觸發器的適用場景：

| 觸發器 | 伺服器端輸出 HTML | 客戶端啟用時機 | 典型元件 |
|--------|---------------|--------------|---------|
| `on visible` | 是 | 進入視窗 | 推薦列表、FAQ、頁尾 |
| `on interaction` | 是 | click/focus/touch | 評論區、表單、折疊面板 |
| `on idle` | 是 | requestIdleCallback | 非關鍵分析元件、社群分享 |
| `when condition()` | 是 | signal 為 true | 需要程式控制的場景 |

## 選擇性水合邊界的劃分原則

不是所有元件都適合延遲水合。我們的劃分標準：

**必須立即水合**：導覽列、搜尋框、購物車入口、登入狀態指示器。這些元件在首屏且需要即時回應互動，延遲水合會導致使用者點擊無反應。

**可以延遲水合**：產品詳情下方的推薦模組、使用者評價區、SEO 長文字區塊、第三方嵌入（地圖、影片）。這些要麼不在首屏，要麼不需要即時互動。

**不應該用水合**：純展示且永遠不需要互動的內容。直接用 `ngNonBindable` 或原生 HTML，連 Angular 元件都不要套。

實際操作中容易犯的錯誤是把太多元件標為 `on interaction`。如果使用者在首屏就點了某個本該 `on visible` 水合的元件，它會先經歷一次「看起來可點但點了沒反應」的階段，然後才啟用。這對 UX 的傷害比多花幾十毫秒全量水合更大。

## 與 Zoneless Change Detection 的配合

Zoneless 模式下沒有 Zone.js 的 monkey-patching，變更偵測完全由 signals 和明確 `markForCheck` 驅動。這和增量水合天然契合——每個 defer 塊水合時只需要建立自己的 signal subscription，不需要全域 Zone 來追蹤非同步操作。

```typescript
// zoneless app config
bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
  ],
});
```

注意 `withIncrementalHydration()` 這個 provider。不帶它的話，即使樣板裡寫了 `hydrate on ...`，Angular 也會退回到全量水合。這是 23.0 的一個易忽略的設定項。

Zoneless + 增量水合的組合效果是雙重的：一方面減少了需要水合的元件數量，另一方面每個被水合的元件也不再攜帶 Zone.js 的執行時開銷。在我們的測試中，兩者疊加的收益大於各自單獨使用之和。

## 度量 Hydration 成本：TBT 和 INP 的前後對比

遷移前後我們用 Lighthouse CI + Web Vitals API 做了持續監控。資料來自同一組 URL（20 個行銷頁 + 5 個功能頁），取樣一週取 p75：

| 指標 | 全量水合 (v21+Zone.js) | 增量水合 (v23+Zoneless) | 變化 |
|------|----------------------|------------------------|------|
| TBT (p75) | 380ms | 140ms | -63% |
| INP (p75) | 290ms | 110ms | -62% |
| LCP (p75) | 2.1s | 1.9s | -10% |
| CLS (p75) | 0.02 | 0.01 | -50% |
| JS Bundle (首屏) | 420KB | 285KB | -32% |

TBT 和 INP 改善最大，因為大量非首屏元件的水合工作被推遲或消除了。LCP 改善有限，因為 LCP 主要取決於圖片和字體載入，hydration 對它的直接影響不大。CLS 的改善來自 `@defer` 塊預留佔位符（`placeholder`）的正確使用。

JS Bundle 減小是因為 zoneless 移除了 Zone.js（~40KB gzip），加上部分 defer 塊的程式碼被拆分到 lazy chunk。

度量時的一個注意事項：不要只看 Lighthouse lab data。Lab 環境跑在模擬裝置上，hydration 的時間佔比會被放大。Field data（真實使用者資料）才是最終評判標準。我們在 field data 上看到 INP good rate 從 78% 提升到 94%。

## 內容頁 vs 儀表板：不同的策略

行銷內容頁和功能儀表板的 hydration 策略應該完全不同。

**內容頁（行銷站）**：以閱讀為主，互動集中在少數元件（CTA 按鈕、表單、搜尋）。策略是激進地延遲水合——首屏以上的 CTA 立即水合，其餘全部 `on visible` 或 `on interaction`。目標是讓讀者在 JS 還沒載入完時就能流暢捲動閱讀。

```html
<!-- 行銷頁的典型結構 -->
<header>
  <navbar /> <!-- 立即水合 -->
</header>

<main>
  <hero-section /> <!-- 立即水合，包含 CTA -->

  @defer (hydrate on visible) {
    <feature-highlights />
  }

  @defer (hydrate on visible) {
    <testimonial-carousel />
  }

  @defer (hydrate on interaction) {
    <pricing-calculator />
  }

  @defer (hydrate on idle) {
    <seo-long-form-content />
  }
</main>

<footer>
  @defer (hydrate on visible) {
    <site-footer />
  }
</footer>
```

**儀表板**：幾乎所有元件都需要即時互動。策略是最小化延遲水合——只對明確不在首屏且載取代價大的元件使用 `on visible`，其餘保持立即水合。目標是在首屏內提供完整的互動能力。

```html
<!-- 儀表板的典型結構 -->
<dashboard-layout>
  <sidebar-nav /> <!-- 立即水合 -->
  <top-bar /> <!-- 立即水合 -->

  <main-content>
    <kpi-cards /> <!-- 立即水合 -->
    <chart-panel /> <!-- 立即水合 -->

    @defer (hydrate on visible) {
      <detailed-data-table /> <!-- 表格很長，折疊區域延遲 -->
    }

    @defer (hydrate on interaction) {
      <export-dialog /> <!-- 對話方塊，點擊才需要 -->
    }
  </main-content>
</dashboard-layout>
```

## 踩坑記錄

**Event Replay Flicker**。Angular 在水合完成前會錄製使用者事件，水合完成後重放。如果使用者在 hydration 期間快速點擊了一個 `on interaction` 的按鈕，事件重放時可能出現視覺閃爍——按鈕先顯示未啟用狀態，重放後跳到啟用狀態。解決方案是給這類元件加 CSS transition 做平滑過渡，或者在極端情況下改用 `on visible` 提前水合。

**SEO 與 Deferred Content**。搜尋引擎能抓取伺服器端渲染的 HTML，但對 `@defer` 塊的行為取決於觸發器。`on visible` 和 `on idle` 的內容在 HTML 中存在，爬蟲能看到。`on interaction` 的內容同樣存在於初始 HTML 中（這是增量水合的前提）。但如果誤用了不帶 `hydrate` 的純 `@defer`，該區塊在伺服器端不會渲染，SEO 內容就丟了。每次 code review 都要確認 defer 塊帶沒帶 `hydrate`。

**Signal 初始化時序**。Zoneless 模式下，defer 塊內的 signal 在元件實體化時才建立。如果父元件透過 input signal 傳遞資料給延遲水合的子元件，要確保子元件水合時 signal 已經有值。否則會出現短暫的空狀態閃爍。用 `@if (data())` 包裹或在 signal 上設預設值可以避免。

**Testing 複雜度增加**。單元測試中 `@defer (hydrate on visible)` 的元件預設不會渲染。需要在 TestBed 中設定 `deferBlockBehavior: DeferBlockBehavior.Playthrough` 來強制渲染所有 defer 塊，或者逐個手動觸發。這增加了測試設定的負擔。

**第三方函式庫相容性**。部分 UI 函式庫的內部元件假設了立即水合的環境。比如某些 carousel 函式庫在水合前計算 slide 寬度，結果拿到 0。遇到這種情況要麼提 PR 修復，要麼把該元件改為立即水合。

## 小結

Angular 23 的增量水合把 hydration 從一個全域開關變成了可以逐元件調節的旋鈕。和 zoneless 搭配使用時，效能收益顯著——我們的行銷站 TBT 降了 63%，INP good rate 從 78% 到 94%。但精細控制也帶來了新的決策負擔：每個元件都要判斷該用什麼觸發器，錯了就可能損害 UX 或 SEO。建議從內容型頁面開始嘗試，積累經驗後再推廣到互動式應用。度量時以 field data 為準，lab data 僅作參考。
