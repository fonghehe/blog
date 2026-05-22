---
title: "Angular 12 新特性：Ivy 獨佔、Webpack 5 默認與 Sass 升級"
date: 2021-07-30 10:56:08
tags:
  - Angular
  - TypeScript
  - 工程化
readingTime: 2
description: "Angular 12 於 2021 年 5 月 26 日正式發佈。這是一個里程碑版本：View Engine 正式退場，Ivy 成為唯一渲染引擎；Webpack 5 從實驗性升級為默認構建工具。升級之後我們整理了一份完整的變化記錄。"
wordCount: 488
---

Angular 12 於 2021 年 5 月 26 日正式發佈。這是一個里程碑版本：View Engine 正式退場，Ivy 成為唯一渲染引擎；Webpack 5 從實驗性升級為默認構建工具。升級之後我們整理了一份完整的變化記錄。

## View Engine 正式停用

Angular 12 中 `@angular/compiler` 不再包含 View Engine，`ngcc` 也不再需要（因為所有庫都已用 Ivy 格式發佈）。

**對開發者的影響**：

- 升級 Angular 12 後，項目需要所有依賴都是 Ivy 相容版本
- 使用舊版第三方庫（未更新到 Angular 9+ 的）可能報錯
- `enableIvy: false` 配置不再有效

## Webpack 5 正式成為默認

```bash
# Angular 12 之前
ng new my-app  # 使用 Webpack 4

# Angular 12 之後
ng new my-app  # 使用 Webpack 5（持久化緩存默認開啓）
```

**持久化緩存的實際效果**（中型項目測試）：

```
首次 ng serve：28s
第二次 ng serve（無代碼變化）：4s  ← 持久化緩存命中
修改一個組件後 ng serve：6s  ← 增量重建
```

持久化緩存存儲在 `.angular/cache` 目錄，建議加入 `.gitignore`：

```bash
echo ".angular/cache" >> .gitignore
```

## strictTemplates 成為新項目默認

Angular 12 開始，所有新項目默認啓用 `strictTemplates`，無需 `--strict` flag：

```json
// tsconfig.json（Angular 12 新項目默認設定）
{
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

## Sass API 更新（重要！）

Angular 12 升級了對 Sass 的支持，廢棄舊版 Node Sass API，改用 Dart Sass 的現代 API：

```bash
# 之前：需要 node-sass（C++ 依賴，安裝麻煩）
npm install node-sass

# Angular 12：sass（純 JS 實現）
npm install sass
```

**遷移舊的 Sass 寫法**：

```scss
// ❌ 舊 API（已廢棄）
@import "variables"; // 使用 @import

// ✅ 新 API
@use "variables" as v;
@use "mixins";

.button {
  color: v.$primary-color; // 使用命名空間
  @include mixins.flex-center;
}
```

`@use` 替代 `@import` 的好處：避免全局作用域污染，每個文件明確聲明依賴。

## Inline Sass（內聯樣式支援）

Angular 12 的 CLI 支持在組件裏用 Sass 語法寫內聯樣式：

```typescript
@Component({
  selector: "app-button",
  template: `<button class="btn">點擊</button>`,
  styles: [
    `
      $primary: #0066ff;
      .btn {
        background: $primary;
        &:hover {
          background: darken($primary, 10%);
        }
      }
    `,
  ],
})
export class ButtonComponent {}
```

## ng build 默認生產模式

```bash
# Angular 12 之前
ng build           # 開發模式
ng build --prod    # 生產模式（需要顯式指定）

# Angular 12 之後
ng build           # 生產模式（默認！）
ng build --configuration development  # 開發模式
```

這個改變防止了"忘記加 `--prod` 就發佈了開發版本"的事故。

## 升級到 Angular 12

```bash
ng update @angular/core@12 @angular/cli@12

# 主要遷移內容（CLI 自動處理）：
# 1. 更新 tsconfig 中廢棄的選項
# 2. 遷移 ng build 默認設定
# 3. 更新 Sass 相關設定
```

**注意**：如果依賴了未升級到 Ivy 的第三方庫，升級可能失敗。先用 `ng update --list` 檢查：

```bash
ng update --list
# 會列出哪些包需要先升級
```

## 總結

Angular 12 的變化裏，View Engine 退場是最有象徵意義的——Ivy 時代正式開始。Webpack 5 默認開啓讓增量構建速度翻倍，`ng build` 默認生產模式則消除了一類常見的部署事故。這次升級對絕大多數項目來説是低風險的，推薦儘快跟進。