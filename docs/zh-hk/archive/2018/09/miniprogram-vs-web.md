---
title: "微信小程序開發：與 Web 開發的異同"
date: 2018-09-24 15:29:30
tags:
  - 前端
readingTime: 2
description: "最近接了一個微信小程序需求，有 Web 基礎的情況下上手還挺快，但也有不少地方需要適應。"
---

最近接了一個微信小程序需求，有 Web 基礎的情況下上手還挺快，但也有不少地方需要適應。

## 相似的地方

小程序的組件和 Vue 很像：

```javascript
// Vue 組件
export default {
  data() {
    return { count: 0, list: [] };
  },
  computed: {
    doubleCount() {
      return this.count * 2;
    },
  },
  methods: {
    increment() {
      this.count++;
    },
  },
  mounted() {
    this.loadData();
  },
};
```

```javascript
// 小程序 Page
Page({
  data: {
    count: 0,
    list: [],
  },
  // 沒有 computed，需要手動更新
  onLoad() {
    this.loadData();
  }, // ≈ mounted
  onShow() {}, // 每次顯示時觸發
  increment() {
    this.setData({ count: this.data.count + 1 }); // 必須用 setData
  },
  async loadData() {
    const res = await wx.request({ url: "..." });
    this.setData({ list: res.data });
  },
});
```

## 不同的地方

### 1. 沒有 DOM，不能用 Web API

```javascript
// ❌ 小程序裏這些都不能用
document.getElementById("xxx");
window.localStorage;
XMLHttpRequest;
fetch;

// ✅ 用小程序提供的 API
wx.request({ url, method, data, success, fail }); // 網絡請求
wx.setStorageSync("key", value); // 本地存儲
wx.showToast({ title: "成功" }); // Toast 提示
```

### 2. 路由方式

```javascript
// 小程序路由
wx.navigateTo({ url: "/pages/detail/detail?id=123" }); // 跳轉（可返回）
wx.redirectTo({ url: "/pages/home/home" }); // 替換（不可返回）
wx.navigateBack({ delta: 1 }); // 返回
wx.switchTab({ url: "/pages/index/index" }); // 跳轉 tabBar 頁面

// URL 傳參（只能是字符串）
// 接收：onLoad(options) { const id = options.id }
```

### 3. 組件生命週期

```javascript
// 比 Web 多了幾個：
onLoad(options); // 頁面加載，只執行一次，options 是路由參數
onShow(); // 頁面顯示（從後台/其他頁面回來也觸發）
onHide(); // 頁面隱藏
onUnload(); // 頁面卸載（navigateTo 不觸發，redirectTo 觸發）
onPullDownRefresh(); // 下拉刷新
onReachBottom(); // 觸底加載更多
```

### 4. 樣式限制

```css
/* 小程序用 rpx（responsive pixel）作為單位 */
/* 750rpx = 屏幕寬度 → 1rpx ≈ 0.5px（iPhone 6） */
.container {
  width: 750rpx; /* 全屏寬 */
  padding: 24rpx;
  font-size: 28rpx;
}

/* 不支持：* 選擇器、標籤選擇器（限制） */
/* 支持：類選擇器、ID 選擇器、偽類 */
```

### 5. wxs：模板裏的邏輯

小程序模板裏不能直接調用 methods，需要用 wxs：

```html
{% raw %}
<!-- WXML -->
<wxs module="utils" src="./utils.wxs"></wxs>
<view>{{ utils.formatDate(date) }}</view>
{% endraw %}
```

```javascript
// utils.wxs（不是 JS！有語法限制）
var formatDate = function (date) {
  return date.substring(0, 10);
};
module.exports = { formatDate: formatDate };
```

## 推薦工具

- **uni-app**：一套代碼發佈到多端（小程序/H5/App）
- **Taro**：類 React 語法，編譯到各端
- **WePY**：類 Vue 語法的小程序框架

如果項目只針對微信小程序，原生開發就夠用。如果需要多端，uni-app 或 Taro 值得考慮。

## 小結

- 小程序和 Vue 設計理念相似，有 Web 基礎上手快
- 最大差異：沒有 DOM/BOM，所有 API 都是 `wx.*`
- 用 `setData` 觸發視圖更新，不能直接修改 `data`
- rpx 是小程序專用單位，750rpx = 屏幕全寬
