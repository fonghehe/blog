---
title: "Angular 22 RC 預覽：全新編譯器與增強 Zoneless 架構"
date: 2026-04-24 14:58:35
tags:
  - Angular
  - CSS
readingTime: 3
description: "Angular 22 Release Candidate 於 2026 年 4 月底釋出，按慣例正式版將在約三週後的 5 月中旬到來。這是繼 Angular 17 引入新範本語法以來最具影響力的版本——全新的 Ivy 第二代編譯器（內部代號 \"Evergreen\"）將大幅縮短構建時間，併為 Signal 模型提供更深層"
wordCount: 643
---

Angular 22 Release Candidate 於 2026 年 4 月底釋出，按慣例正式版將在約三週後的 5 月中旬到來。這是繼 Angular 17 引入新模板語法以來最具影響力的版本——全新的 Ivy 第二代編譯器（內部代號 "Evergreen"）將大幅縮短構建時間，併為 Signal 模型提供更深層的編譯期最佳化。

## Evergreen 編譯器：構建速度的質變

Angular 22 的核心是重寫的編譯器。相較於 Ivy，Evergreen 在增量編譯場景下速度提升顯著：

| 專案規模            | Ivy 冷啟動 | Evergreen 冷啟動 | Ivy 熱重載 | Evergreen 熱重載 |
| ------------------- | ---------- | ---------------- | ---------- | ---------------- |
| 小型（< 50 元件）   | 3.2s       | 1.8s             | 280ms      | 120ms            |
| 中型（50-200 元件） | 12s        | 5.5s             | 650ms      | 210ms            |
| 大型（200+ 元件）   | 38s        | 14s              | 1.8s       | 480ms            |

Evergreen 的核心最佳化：

- **增量依賴分析**：只重新分析受變更影響的模組子圖，而非整個依賴樹
- **並行型別檢查**：將 TypeScript 型別檢查分散到多個 Worker 並行執行
- **Signal 感知 tree-shaking**：編譯期識別 Signal 依賴關係，更激進地消除死程式碼

## Signal 的編譯期最佳化

Evergreen 編譯器能在編譯期靜態分析 Signal 依賴圖，生成更高效的變更檢測程式碼：

```typescript
@Component({
  template: `
    <h1>{{ title() }}</h1>
    <p>{{ description() }}</p>
    <app-price [value]="price()" />
  `,
})
export class ProductComponent {
  title = signal("產品名稱");
  description = signal("產品描述");
  price = signal(0);
}
```

Evergreen 會分析出 `<h1>` 只依賴 `title`，`<p>` 只依賴 `description`，因此當 `price` 變化時，只更新 `<app-price>` 的 DOM，而不觸發整個元件重渲染。這在 Ivy 中需要手動拆分元件才能實現。

## Zoneless 架構的正式推薦

Angular 22 將 Zoneless 從"穩定"升級為"**官方推薦**"模式——新專案的 `ng new` 預設生成 Zoneless 配置：

```typescript
// angular.json 新專案預設配置
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "zoneless": true  // 22 開始是預設值
          }
        }
      }
    }
  }
}
```

```typescript
// main.ts 新專案模板
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // 預設包含
  ],
});
```

## 新增：資源預獲取指令

Angular 22 RC 引入了宣告式資源預獲取，無需手動呼叫 `prefetchResource`：

```typescript
@Component({
  template: `
    <!-- 滑鼠懸停時預獲取詳情資料 -->
    <a
      routerLink="/products/{{ id }}"
      ngPrefetch="hover"
      [ngPrefetchData]="productDetailPrefetch"
    >
      檢視詳情
    </a>
  `,
})
export class ProductListItemComponent {
  id = input.required<number>();

  productDetailPrefetch = httpResource(
    () => null, // 初始不載入
    { prefetchOnly: true }, // 僅預獲取，不影響當前檢視
  );
}
```

## 遷移到 Angular 22

RC 階段可以提前驗證升級相容性：

```bash
# 安裝 RC 版本
npm install @angular/core@22.0.0-rc.0 @angular/cli@22.0.0-rc.0

# 執行遷移 schematic
ng update @angular/core@22.0.0-rc.0 --migrate-only
```

主要 breaking changes：

1. **`NgModule` 的徹底可選化**：22 起，任何 `NgModule` 相關的 API 在新專案中均不會出現
2. **`ChangeDetectionStrategy.Default` 棄用**：現有專案可繼續使用，但 IDE 會顯示棄用警告
3. **`zone.js` 從預設依賴中移除**：不再自動安裝，如需保留 zone 模式需手動新增

## 總結

Angular 22 RC 展示了一個在工具鏈和架構層面雙雙成熟的 Angular。Evergreen 編譯器大幅改善了開發體驗，Zoneless 的預設化標誌著整個框架的技術路線已完全轉向 Signal 驅動。正式版預計 5 月中旬釋出，值得現在就在非關鍵專案上驗證升級可行性。
