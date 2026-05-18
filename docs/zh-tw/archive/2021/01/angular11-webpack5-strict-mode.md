---
title: "Angular 11 實戰：Webpack 5 整合與嚴格模式全面啟用"
date: 2021-01-02 09:43:58
tags:
  - Angular
  - Webpack
  - TypeScript
  - CSS
  - HTML
readingTime: 2
description: "Angular 11 於 2020 年 11 月釋出，進入新的一年，這裡系統總結升級後最值得深入使用的兩個特性：Webpack 5 實驗性支援和嚴格模式。前者大幅提升構建速度，後者幫你從根源消滅一類 bug。"
---

Angular 11 於 2020 年 11 月釋出，進入新的一年，這裡系統總結升級後最值得深入使用的兩個特性：Webpack 5 實驗性支援和嚴格模式。前者大幅提升構建速度，後者幫你從根源消滅一類 bug。

## 開啟 Webpack 5 實驗性支援

Angular 11 將 Webpack 5 列為實驗性功能，正式穩定要等 Angular 12。但現在就可以體驗它的持久化快取：

```bash
# 1. 使用 yarn（Webpack 5 需要 yarn resolutions）
yarn set version berry  # 可選

# 2. package.json 新增 resolutions
```

```json
{
  "resolutions": {
    "webpack": "^5.0.0"
  },
  "scripts": {
    "postinstall": "ngcc"
  }
}
```

```bash
yarn install
```

```json
// angular.json - 開啟實驗性 Webpack 5
{
  "cli": {
    "packageManager": "yarn"
  }
}
```

**構建速度對比**（中型專案，約 150 個元件）：

|           | 首次構建 | 增量構建（持久化快取後） |
| 
--------- | -------- | ------------------------ |
| Webpack 4 | 45s      | 18s                      |
| Webpack 5 | 38s      | **4s**                   |

持久化快取帶來的 4s 增量構建是最大收益——日常開發中幾乎感覺不到等待。

## 嚴格模式：一次性到位

新專案用 `ng new --strict` 預設開啟。老專案需要手動啟用：

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### strictTemplates 捕獲的典型錯誤

**1. 可選鏈問題**

```html
<!-- ❌ user 可能是 null，嚴格模式會報錯 -->
<p>{{ user.name }}</p>

<!-- ✅ 方式一：使用 *ngIf -->
<p *ngIf="user">{{ user.name }}</p>

<!-- ✅ 方式二：可選鏈 -->
<p>{{ user?.name }}</p>
```

**2. EventEmitter 型別推斷**

```typescript
// ❌ 沒有型別引數，嚴格模式下 $event 為 any
@Output() selected = new EventEmitter();

// ✅ 明確型別
@Output() selected = new EventEmitter<User>();
```

**3. ngFor 的 trackBy 型別**

```typescript
// ❌ 嚴格模式下，trackBy 函式引數型別必須匹配
// trackBy(index: number, item) - item 是 any

// ✅ 明確型別
trackByUser(index: number, user: User): number {
  return user.id;
}
```

## 字型內聯（Font Inlining）

Angular 11 預設在構建時將 Google Fonts 的 CSS 內聯，減少一次網路往返：

```json
// angular.json - 預設已開啟，如需關閉：
{
  "build": {
    "options": {
      "optimization": {
        "fonts": false
      }
    }
  }
}
```

對 LCP（最大內容繪製）指標有正向影響，推薦保持開啟。

## strictInputAccessModifiers

這是 Angular 11 新增的編譯器選項，防止從模板訪問 private/protected 屬性：

```typescript
@Component({
  template: `{{ privateData }}`, // ❌ 嚴格模式報錯
})
export class MyComponent {
  private privateData = "secret";
  protected protectedData = "also restricted";
}
```

這個規則強制模板只使用 public API，有助於元件封裝。

## 升級步驟

```bash
ng update @angular/core@11 @angular/cli@11
ng update @angular/material@11  # 如果使用 Material

# 檢視升級指南
ng update --list
```

## 總結

Angular 11 對現有專案來說是低風險高收益的升級。嚴格模式值得在年初規劃一次全面開啟——配合 TypeScript 4.1 的模板字面量型別，2021 年 Angular 專案的型別安全會上一個臺階。
