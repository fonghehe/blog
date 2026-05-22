---
title: "Angular 9 正式發佈：Ivy 引擎帶來的效能革命"
date: 2020-02-21 15:24:12
tags:
  - Angular
readingTime: 2
description: "Angular 9 於 2020 年 2 月 6 日正式發佈，Ivy 渲染引擎成為默認選項。升級了一批內部項目後，來分享真實的體積變化數據和踩坑經驗。"
wordCount: 372
---

Angular 9 於 2020 年 2 月 6 日正式發佈，Ivy 渲染引擎成為默認選項。升級了一批內部項目後，來分享真實的體積變化數據和踩坑經驗。

## 實際體積變化數據

官方數據有時過於樂觀，這是我們內部幾個項目升級後的實測結果：

| 項目規模          | 升級前 main.js | 升級後 main.js | 減少 |
| 
----------------- | -------------- | -------------- | ---- |
| 小型（20 組件）   | 187KB          | 131KB          | 30%  |
| 中型（80 組件）   | 412KB          | 268KB          | 35%  |
| 大型（200+ 組件） | 891KB          | 671KB          | 25%  |

大型項目減少比例相對小，因為業務代碼佔比更高，框架代碼的 tree-shaking 收益被稀釋。

## 升級步驟

```bash
# 一鍵升級（推薦）
ng update @angular/core@9 @angular/cli@9

# CLI 會自動：
# 1. 更新 package.json 依賴版本
# 2. 運行 migration schematic（處理 ViewChild static、字符串 loadChildren 等）
# 3. 運行 ngcc 編譯第三方庫
```

## 升級後常見問題排查

**1. ExpressionChangedAfterItHasBeenCheckedError 增多**

Ivy 的變更檢測更嚴格。常見原因是在 `ngAfterViewInit` 裏修改了父組件綁定的值：

```typescript
// ❌ 觸發錯誤
ngAfterViewInit() {
  this.title = 'loaded'; // 父組件模板綁定了 title
}

// ✅ 用 setTimeout 或 ChangeDetectorRef 解決
constructor(private cdr: ChangeDetectorRef) {}
ngAfterViewInit() {
  setTimeout(() => {
    this.title = 'loaded';
    this.cdr.detectChanges();
  });
}
```

**2. 第三方組件庫樣式異常**

Ivy 改變了組件樣式封裝的實現方式，某些依賴 `.mat-xxx` 等全局類的樣式寫法可能失效：

```scss
// ❌ 在宿主組件樣式裏穿透子組件（Ivy 下可能不生效）
:host ::ng-deep .mat-input-element {
  color: red;
}

// ✅ 在全局樣式（styles.scss）裏覆蓋
.my-custom-input .mat-input-element {
  color: red;
}
```

**3. 動態組件創建 API 變化**

```typescript
// View Engine 方式（仍兼容但不推薦）
const factory = this.resolver.resolveComponentFactory(MyComponent);
this.container.createComponent(factory);

// Ivy 推薦方式（Angular 9+ 支持）
this.container.createComponent(MyComponent);
```

## 新增的 providedIn 選項

```typescript
// Angular 9 新增 'any' 和 'platform' 選項
@Injectable({ providedIn: 'any' })
// 'any': 每個懶加載模塊獲得獨立實例，根模塊共享一個實例

@Injectable({ providedIn: 'platform' })
// 'platform': 多個 Angular 應用之間共享同一實例（微前端場景）
```

## TestBed 效能提升

Angular 9 的 TestBed 在 Ivy 下不再每次都重新編譯組件，測試套件運行速度顯著提升：

```typescript
// 不變的測試代碼，但執行速度快了 2-3x
describe("UserComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserComponent],
    }).compileComponents();
  });
  // ...
});
```

## 總結

Angular 9 是近年來對開發者最友好的大版本升級——絕大多數項目可以無痛升級，體積和性能都有實質改善。如果你還在 Angular 8 上，現在就是升級的好時機。
