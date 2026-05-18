---
title: "微前端初探：當專案大到一個人管不動時"
date: 2018-10-15 10:10:23
tags:
  - 微前端
  - 工程化
readingTime: 6
description: "我們的後臺管理系統是三年前用 Vue 2 搭的，最開始只有幾個頁面，體驗很好。但三年過去，它已經變成了一個龐然大物："
---

## 問題背景

我們的後臺管理系統是三年前用 Vue 2 搭的，最開始只有幾個頁面，體驗很好。但三年過去，它已經變成了一個龐然大物：

- 50+ 路由頁面
- 200+ 個元件
- 3 個團隊共 12 個人同時在上面開發
- Webpack 構建 4 分鐘起步
- 主包體積 3MB+，首屏載入越來越慢

更要命的是，每次發版都是全量釋出。訂單模組改了個文案，整個系統都得重新部署。上週庫存模組上線了一個 bug，直接把整個後臺搞掛了，跟我們使用者模組半毛錢關係沒有，但大家的工單系統全崩了。

團隊裡有人開玩笑說："這專案已經不是一個人能管得動的了。" 其實不是玩笑。

## 什麼是微前端

微前端這個概念，本質上是把後端微服務的思想搬到前端。

後端早就經歷了從單體到微服務的拆分——把一個大的 Java 應用拆成多個獨立部署的服務，每個服務有自己的資料庫、自己的釋出節奏。前端現在也走到了這一步。

核心思路：

```
傳統單體 SPA：
┌─────────────────────────────────────┐
│           單體前端應用               │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 使用者  │ │ 訂單  │ │ 庫存  │        │
│  └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
一個程式碼倉庫，一個構建產物，一個部署單元

微前端：
┌─────────────────────────────────────┐
│           主應用（Shell）             │
│  ┌──────────┐ ┌──────────┐          │
│  │ 使用者子應用 │ │ 訂單子應用 │          │
│  │ 獨立倉庫  │ │ 獨立倉庫  │          │
│  │ 獨立部署  │ │ 獨立部署  │          │
│  └──────────┘ └──────────┘          │
└─────────────────────────────────────┘
各模組獨立開發、獨立構建、獨立部署
```

每個子應用可以有自己的技術棧、自己的釋出週期，團隊之間互不干擾。

## 現有方案對比

在動手之前，我花了一週時間調研了幾種方案。

### 方案一：iframe

最古老也最直接的方式。主應用提供導航框架，子應用通過 iframe 載入。

```html
<!-- 主應用 shell -->
<div id="layout">
  <sidebar-nav />
  <main>
    <iframe :src="currentAppUrl" frameborder="0"></iframe>
  </main>
</div>
```

優點是隔離性極好——樣式、JS、全域性變數完全獨立。缺點也很明顯：路由同步困難，彈窗被 iframe 邊界截斷，頁面間通訊只能靠 `postMessage`，而且 iframe 內的載入體驗比較差。

### 方案二：Nginx 路由分發

不同路徑轉發到不同的前端應用部署：

```nginx
location /user/ {
  proxy_pass http://user-app-server/;
}
location /order/ {
  proxy_pass http://order-app-server/;
}
```

簡單粗暴，但路徑切換時整頁重新整理，體驗不好。而且公共部分（導航欄、使用者資訊）每個子應用都得重複實現一遍。

### 方案三：npm 包拆分

把公共模組抽成 npm 包，各業務團隊維護自己的倉庫，最終在主應用中組裝。

這種方式對構建流程改動最小，但本質上並沒有解決獨立部署的問題——任何一個模組更新，主應用還是得重新構建釋出。

### 方案四：single-spa

最近關注到的一個專案叫 [single-spa](https://single-spa.js.org/)，它提供了一個執行時框架，讓多個前端應用可以在同一個頁面共存，通過生命週期管理來協調掛載和解除安裝：

```javascript
import { registerApplication, start } from "single-spa";

registerApplication(
  "user-app",
  () => System.import("@org/user-app"),
  (location) => location.pathname.startsWith("/user"),
);

registerApplication(
  "order-app",
  () => System.import("@org/order-app"),
  (location) => location.pathname.startsWith("/order"),
);

start();
```

子應用需要暴露 `bootstrap`、`mount`、`unmount` 三個生命週期鉤子。思路很好，但目前社群還不大，文件也比較簡陋，對 Vue 的支援需要額外適配。感覺是個有前途的方向，但現階段直接上生產環境風險不小。

## 我們的嘗試：iframe 方案 PoC

考慮到團隊當前的技術儲備和風險承受能力，我們決定先用最保守的 iframe 方案做一個 PoC，把使用者管理模組從主應用中拆出來。

整體架構：

```
┌────────────────────────────────────────────┐
│  主應用 Shell（Vue 2）                       │
│  ┌──────────────────────────────────────┐  │
│  │  頂部導航 + 側邊欄                    │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │  <iframe :src="userAppUrl" />        │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
        │                        │
        ▼                        ▼
   主應用部署                  使用者子應用部署
（其他 40+ 頁面）          （Vue 2, 獨立倉庫）
```

關鍵問題是如何共享登入態。我們的做法是：主應用登入後把 token 寫入 cookie（設 domain 為 `.company.com`），子應用從 cookie 中讀取：

```javascript
// 主應用：登入成功後
document.cookie = `auth_token=${token}; domain=.company.com; path=/`;

// 子應用：啟動時讀取
function getAuthToken() {
  const match = document.cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

// 子應用：發起請求時帶上 token
axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

子應用之間通過 `postMessage` 通訊：

```javascript
// 主應用 → 子應用：傳遞使用者資訊
iframe.contentWindow.postMessage(
  { type: "USER_INFO", payload: { userId: 123, role: "admin" } },
  "https://user.company.com",
);

// 子應用監聽
window.addEventListener("message", (event) => {
  if (event.data.type === "USER_INFO") {
    store.commit("setUserInfo", event.data.payload);
  }
});

// 子應用 → 主應用：觸發路由跳轉
window.parent.postMessage(
  { type: "NAVIGATE", payload: "/order/detail/456" },
  "https://admin.company.com",
);
```

## 踩過的坑

做 PoC 的過程中踩了不少坑，說幾個印象深刻的。

**1. iframe 高度自適應**

iframe 預設不會根據內容撐高，設 `height: 100%` 會出現雙捲軸。我們的做法是子應用通過 `postMessage` 告訴主應用自己的內容高度：

```javascript
// 子應用：內容變化時通知主應用
const observer = new ResizeObserver(() => {
  window.parent.postMessage(
    { type: "RESIZE", height: document.body.scrollHeight },
    "*",
  );
});
observer.observe(document.body);

// 主應用：接收高度並設定 iframe 樣式
window.addEventListener("message", (event) => {
  if (event.data.type === "RESIZE") {
    iframe.style.height = event.data.height + "px";
  }
});
```

**2. 彈窗和遮罩層被截斷**

iframe 內的 Modal 或 Toast 會被限制在 iframe 邊界內，無法覆蓋整個螢幕。這是 iframe 方案最頭疼的問題。我們的妥協是：彈窗在主應用中實現，子應用通過 `postMessage` 請求主應用彈窗。但這增加了耦合。

**3. 瀏覽器前進/後退**

iframe 內的路由變化不會被瀏覽器歷史記錄捕獲。需要主應用和子應用的路由做同步——子應用路由變化時通知主應用，主應用更新 URL query 引數，iframe 再根據 query 引數跳轉。邏輯繞了好幾層，程式碼不太好維護。

## 什麼時候該用微前端

說了這麼多坑，是不是微前端就不值得做？也不是。但確實不是所有專案都需要。

**適合的場景：**

- 多個團隊維護同一個大型前端應用，協作衝突頻繁
- 不同模組需要獨立發版，降低釋出風險
- 遺留系統需要漸進式遷移（比如從 jQuery 遷到 Vue）
- 模組之間邊界清晰，互動相對簡單

**不適合的場景：**

- 專案不大，兩三個人就能維護——別過度設計
- 模組之間有大量複雜的聯動互動——拆分後的通訊成本會很高
- 團隊沒有 DevOps 基礎設施支撐多倉庫、多部署流水線

說白了，微前端解決的是組織問題（多人協作、獨立交付），而不是純技術問題。如果你們團隊沒有被單體應用"卡脖子"，那就別急著上微前端。

## 小結

- 微前端把後端微服務思想引入前端，讓大型應用的各模組可以獨立開發、獨立部署
- 2018 年的主流方案有 iframe、Nginx 路由分發、npm 包拆分、JS 執行時整合
- iframe 方案最簡單、隔離性最好，但路由同步、彈窗截斷、通訊成本是硬傷
- single-spa 是一個有潛力的執行時整合框架，但目前還不太成熟，值得關注但需謹慎採用
- 微前端本質上解決的是團隊協作和獨立交付的組織問題，小專案不需要
- 如果決定做，建議從一個邊界清晰的模組開始 PoC，別一上來就全量拆分
