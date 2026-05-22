---
title: "Angular 9 Beta：AOT 編譯默認開啓與包體積優化"
date: 2019-12-20 09:57:10
tags:
  - Angular
readingTime: 2
description: "Angular 9 目前處於 Beta 階段，預計 2020 年初正式發佈。最大的變化是 Ivy 渲染引擎將成為默認，連帶着 AOT 也將默認開啓。這兩個變化對包體積和範本類型安全都有顯著影響。"
wordCount: 367
---

Angular 9 目前處於 Beta 階段，預計 2020 年初正式發佈。最大的變化是 Ivy 渲染引擎將成為默認，連帶着 AOT 也將默認開啓。這兩個變化對包體積和範本類型安全都有顯著影響。

## AOT vs JIT 回顧

| 特性                | JIT（運行時編譯）          | AOT（構建時編譯） |
| 
------------------- | -------------------------- | ----------------- |
| 編譯時機            | 運行時                     | 構建時            |
| 用户初始加載速度    | 慢（需要下載並解析編譯器） | 快                |
| Bundle 中包含編譯器 | 是（+~100KB）              | 否                |
| 模板錯誤檢測        | 運行時                     | 構建時            |
| Tree-shaking 效果   | 差                         | 好                |

在 Angular 8 中，dev 模式默認是 JIT，production 才用 AOT。Angular 9 將兩種模式都切成 AOT。

## Ivy + AOT 帶來的體積收益

根據 Angular 團隊公佈的數據：

- **小型應用**：減小約 30%
- **中型應用**：減小約 40%
- **大型應用**：收益相對較小，但 tree-shaking 效果改善明顯

## strictTemplates 系列選項

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": true, // 啓用所有模板嚴格檢查
    "strictInputTypes": true, // @Input() 類型檢查
    "strictNullInputTypes": true, // 防止 null/undefined 傳給 @Input
    "strictAttributeTypes": true, // DOM 屬性類型檢查
    "strictOutputEventTypes": true, // @Output() 事件類型檢查
    "strictDomEventTypes": true // DOM 事件類型檢查
  }
}
```

開啓後，模板裏的類型錯誤將在構建時就被捕獲，而不是在運行時。

## 遷移中的常見問題

**1. ViewChild 需要指定 `{ static }` 選項**

```typescript
// Angular 8+ 必須顯式指定
// static: true  = 在 ngOnInit 中可用
// static: false = 在 ngAfterViewInit 中可用
@ViewChild('myRef', { static: false }) myRef: ElementRef;
```

**2. Renderer2 替代 Renderer**

```typescript
// ❌ Renderer 已在 Ivy 中刪除
// ✅ 用 Renderer2
constructor(private renderer: Renderer2) {}
```

**3. 模板類型錯誤修復**

```html
<!-- ❌ 類型不匹配會報錯 -->
<app-user [userId]="'123'"></app-user>
<!-- 如果 userId 是 number -->

<!-- ✅ 類型匹配 -->
<app-user [userId]="123"></app-user>
```

## 升級方法

```bash
# 待正式發佈後
npm install @angular/core@9 @angular/cli@9

# 或者用 ng update
ng update @angular/core @angular/cli
# CLI 自動運行 migration schematic 處理 ViewChild static 等問題
```

## 總結

Angular 9 的核心是“默認更好”——AOT 默認開啓讓開發模式與生產模式一致，消除了“本地正常上線打破”的經典問題。Ivy 的體積收益將讓 Angular 應用在效能指標上更具競爭力。
