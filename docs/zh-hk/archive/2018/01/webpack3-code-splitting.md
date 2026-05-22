---
title: "Webpack 3 代碼分割同懶加載實戰：落地路徑與實戰建議"
date: 2018-01-04 17:02:09
tags:
  - Webpack
  - 工程化
readingTime: 3
description: "單頁應用做大咗之後，打包體積係個繞唔過去嘅問題。我哋嘅項目上線後首屏 JS 一度達到 1.8MB，用戶喺 3G 網絡下等待時間超過 8 秒。呢篇文章記錄用 Webpack 3 嘅代碼分割做優化嘅過程。"
wordCount: 583
---

單頁應用做大咗之後，打包體積係個繞唔過去嘅問題。我哋嘅項目上線後首屏 JS 一度達到 1.8MB，用戶喺 3G 網絡下等待時間超過 8 秒。呢篇文章記錄用 Webpack 3 嘅代碼分割做優化嘅過程。

## 問題診斷

先用 `webpack-bundle-analyzer` 睇清楚包裏面有咩：

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

跑完之後會打開一個可視化頁面，方塊大小代表體積佔比。我哋發現問題：

- `moment.js` 將所有語言包都打進去咗，佔咗 200KB+
- `echarts` 全量引入，其實隻用咗折線圖
- 幾個隻喺特定頁面用到嘅富文本編輯器被打進咗主包

## 入口分割：提取公共依賴

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

咁樣 `vendor` 包含第三方庫，`manifest` 包含 webpack 運行時，業務代碼變更唔會影響 vendor 嘅緩存。

## 動態 import：路由級懶加載

呢個係效果最明顯嘅優化。將路由組件改成動態導入：

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

Webpack 遇到動態 `import()` 會自動生成獨立嘅 chunk。用戶隻有訪問對應路由時先至會加載嗰個 chunk。

## 魔法注釋：俾 chunk 命名

```javascript
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/views/UserSettings");
```

同名嘅 `webpackChunkName` 會被合併成一個 chunk。將功能相關嘅頁面放喺同一個 chunk，減少網絡請求次數。

## 組件級懶加載

唔隻係路由，組件都可以懶加載：

```javascript
export default {
  components: {
    // 隻有渲染到呢個組件時先至加載
    RichEditor: () => import("@/components/RichEditor"),

    // 帶 loading 同 error 狀態
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

moment 默認打包所有語言包，用 `IgnorePlugin` 排除：

```javascript
// webpack.config.js
plugins: [new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)];
```

然後喺需要嘅地方手動引入中文包：

```javascript
import moment from "moment";
import "moment/locale/zh-cn";
moment.locale("zh-cn");
```

光呢一步就減少咗約 170KB（gzip 後約 40KB）。

## 優化結果

| 優化項      | 之前       | 之後            |
| 
----------- | ---------- | --------------- |
| 主包大小    | 1.8MB      | 420KB           |
| vendor 包   | 合併喺主包 | 680KB（強緩存） |
| 首屏加載 JS | 1.8MB      | 420KB           |
| 3G 首屏時間 | 8.2s       | 2.1s            |

vendor 包雖然本身更大，但因為命中咗瀏覽器緩存，二次訪問幾乎唔需要重新加載。

## 注意事項

代碼分割粒度唔係越細越好。每個 chunk 係一個額外嘅 HTTP 請求，太細反而會因為並發請求數量同 HTTP overhead 拖慢速度。HTTP/2 多路複用能緩解呢個問題，但舊項目一般仲喺 HTTP/1.1 上面。

經驗值：單個按需 chunk 細過 20KB（gzip 後）基本冇必要單獨分割。

---

_下一篇：CSS Grid 佈局入門指南_
