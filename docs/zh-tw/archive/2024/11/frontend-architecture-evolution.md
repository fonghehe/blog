---
title: "前端架構演進：從頁面到元件到模組"
date: 2024-11-14 17:08:45
tags:
  - 前端
readingTime: 2
description: "做了七年前端，想從架構角度梳理一下這些年我們的程式碼組織方式是怎麼演進的。"
wordCount: 354
---

做了七年前端，想從架構角度梳理一下這些年我們的程式碼組織方式是怎麼演進的。

## 2016-2017：jQuery 時代的檔案組織

```
/
├── index.html
├── css/
│   ├── reset.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── vendor/
│   │   └── jquery.min.js
│   ├── utils.js
│   ├── api.js
│   └── page-index.js
└── assets/
```

特點：

- 以檔案型別分目錄（css/js/images）
- 每個頁面一個 JS 檔案
- 全域性變數汙染，依賴關係靠註釋宣告
- "程序導向"的程式碼組織

## 2018-2019：Vue/React 元件化時代

```
src/
├── components/        ← 通用元件
│   ├── Button.vue
│   ├── Modal.vue
│   └── Table.vue
├── views/             ← 頁面級元件
│   ├── Home.vue
│   └── UserProfile.vue
├── store/             ← 全域性狀態
├── api/               ← 介面請求
├── utils/             ← 工具函式
└── router/            ← 路由配置
```

特點：

- 以功能型別分目錄
- 元件複用為中心
- 集中式狀態管理（Vuex/Redux）
- 問題：隨專案增長，各目錄越來越膨脹

## 2020-2022：功能模組化

```
src/
├── features/          ← 按功能領域劃分
│   ├── auth/
│   │   ├── AuthForm.tsx
│   │   ├── useAuth.ts
│   │   ├── authSlice.ts
│   │   └── authApi.ts
│   ├── products/
│   │   ├── ProductList.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── useProducts.ts
│   │   └── productApi.ts
│   └── cart/
│       ├── Cart.tsx
│       ├── useCart.ts
│       └── cartSlice.ts
├── shared/            ← 跨功能共享
│   ├── components/    ← 真正通用的元件
│   ├── hooks/
│   ├── utils/
│   └── types/
└── app/               ← 應用入口、路由、全域性配置
```

特點：

- 按業務領域（domain）組織
- 相關程式碼放在一起（高內聚）
- 跨領域的才放 shared/
- 擴充套件性好：加新功能隻需加新目錄

## 2023-2024：分層架構

受 Feature-Sliced Design（FSD）啟發，我們團隊目前用的架構：

```
src/
├── app/               ← 應用入口
│   ├── providers/
│   ├── router/
│   └── store/
├── pages/             ← 頁面（隻負責組合）
│   ├── HomePage/
│   └── ProductPage/
├── widgets/           ← 獨立的頁面區塊
│   ├── Header/
│   ├── Sidebar/
│   └── ProductCatalog/
├── features/          ← 使用者功能（有互動的）
│   ├── auth/
│   ├── cart/
│   └── search/
├── entities/          ← 業務實體
│   ├── product/
│   ├── user/
│   └── order/
└── shared/            ← 技術基礎設施
    ├── ui/            ← 設計系統元件
    ├── api/
    ├── lib/
    └── config/
```

**依賴規則（從上到下，不能反向）：**

```
app → pages → widgets → features → entities → shared
```

## 評估一個架構的維度

```
1. 可尋路性（Navigability）
   新人能在 5 分鐘內找到某個功能的程式碼嗎？

2. 可擴充套件性（Scalability）
   加一個新功能需要改多少檔案？改多少現有程式碼？

3. 可測試性（Testability）
   各模組能獨立測試嗎？測試資料怎麼 mock？

4. 邊界清晰度（Boundary Clarity）
   兩個模組能清楚地劃分責任嗎？
   修改一個模組會意外影響另一個嗎？
```

## 給團隊的建議

架構不是一步到位的。對於不同規模的專案：

```
小專案（1-3人，<50個元件）
  → 按型別分目錄就夠了，別過度設計

中型專案（3-8人，50-200個元件）
  → features/ 模組化，shared/ 共享

大型專案（8人+，200+個元件）
  → 分層架構 + 領域模型 + 程式碼規範
```

## 小結

- 架構演進方向：檔案型別分組 → 元件化 → 功能模組 → 分層架構
- 沒有"最好"的架構，隻有適合當前團隊和專案階段的架構
- 最重要的原則：高內聚（相關程式碼放一起）、低耦合（模組間依賴少）
- 定期重構比一次到位更實際
