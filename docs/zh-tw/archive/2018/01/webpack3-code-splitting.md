---
title: "Webpack 3 程式碼分割與懶加載實戰"
date: 2018-01-04 17:02:09
tags:
  - Webpack
  - 工程化
readingTime: 3
description: "單頁應用做大了之後，打包體積是個繞不過去的問題。我們的專案上線後首屏 JS 一度達到 1.8MB，使用者在 3G 網路下等待時間超過 8 秒。這篇文章記錄用 Webpack 3 的程式碼分割做優化的過程。"
---

單頁應用做大了之後，打包體積是個繞不過去的問題。我們的專案上線後首屏 JS 一度達到 1.8MB，使用者在 3G 網路下等待時間超過 8 秒。這篇文章記錄用 Webpack 3 的程式碼分割做優化的過程。

## 問題診斷

先用 `webpack-bundle-analyzer` 看清楚套件裡有什麼：

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

跑完之後會開啟一個視覺化頁面，方塊大小代表體積佔比。我們發現問題：

- `moment.js` 把所有語言套件都打進去了，佔了 200KB+
- `echarts` 全量引入，其實只用了折線圖
- 幾個只在特定頁面用到的富文字編輯器被打進了主套件

## 進入點分割：提取公共依賴

```javascript
// webpack.config.js
module.exports = {
  entry: {
    app: "./src/main.js",
    vendor: ["vue", "vue-router", "vuex", "axios"],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      minChunks: Infinity,
    }),
  ],
};
```

這樣 `vendor` 包含第三方函式庫，`manifest` 包含 webpack 執行時，業務程式碼變更不會影響 vendor 的快取。

## 動態 import：路由級懶加載

這是效果最明顯的優化。把路由元件改成動態匯入：

```javascript
// router/index.js

// 之前
import Dashboard from "@/views/Dashboard";
import UserProfile from "@/views/UserProfile";
import OrderList from "@/views/OrderList";

// 之後
const Dashboard = () => import("@/views/Dashboard");
const UserProfile = () => import("@/views/UserProfile");
const OrderList = () => import("@/views/OrderList");

const routes = [
  { path: "/dashboard", component: Dashboard },
  { path: "/profile", component: UserProfile },
  { path: "/orders", component: OrderList },
];
```

Webpack 遇到動態 `import()` 會自動產生獨立的 chunk。使用者只有訪問對應路由時才會載入那個 chunk。

## 魔法註解：給 chunk 命名

```javascript
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserSettings");
```

同名的 `webpackChunkName` 會被合併成一個 chunk。把功能相關的頁面放在同一個 chunk，減少網路請求次數。

## 元件級懶加載

不只是路由，元件也可以懶加載：

```javascript
export default {
  components: {
    // 只有渲染到這個元件時才載入
    RichEditor: () => import("@/components/RichEditor"),

    // 帶 loading 和 error 狀態
    DataChart: () => ({
      component: import("@/components/DataChart"),
      loading: LoadingSpinner,
      error: ErrorComponent,
      delay: 200, // 200ms 後顯示 loading
      timeout: 10000, // 10s 後顯示 error
    }),
  },
};
```

## moment.js 體積問題

moment 預設打包所有語言套件，用 `IgnorePlugin` 排除：

```javascript
// webpack.config.js
plugins: [new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)];
```

然後在需要的地方手動引入中文套件：

```javascript
import moment from "moment";
import "moment/locale/zh-cn";
moment.locale("zh-cn");
```

光這一步就減少了約 170KB（gzip 後約 40KB）。

## 優化結果

| 優化項      | 之前         | 之後            |
| 
----------- | ------------ | --------------- |
| 主套件大小  | 1.8MB        | 420KB           |
| vendor 套件 | 合併在主套件 | 680KB（強快取） |
| 首屏載入 JS | 1.8MB        | 420KB           |
| 3G 首屏時間 | 8.2s         | 2.1s            |

vendor 套件雖然本身更大，但因為命中了瀏覽器快取，二次訪問幾乎不需要重新載入。

## 注意事項

程式碼分割粒度不是越細越好。每個 chunk 是一個額外的 HTTP 請求，太細反而會因為並發請求數量和 HTTP overhead 拖慢速度。HTTP/2 多路複用能緩解這個問題，但舊專案一般還在 HTTP/1.1 上。

經驗值：單個按需 chunk 小於 20KB（gzip 後）基本沒必要單獨分割。

---

_下一篇：CSS Grid 佈局入門指南_
