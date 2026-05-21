---
title: "微信小程序开发：与 Web 开发的异同"
date: 2018-09-24 15:29:30
tags:
  - 前端
readingTime: 2
description: "最近接了一个微信小程序需求，有 Web 基础的情况下上手还挺快，但也有不少地方需要适应。"
wordCount: 249
---

最近接了一个微信小程序需求，有 Web 基础的情况下上手还挺快，但也有不少地方需要适应。

## 相似的地方

小程序的组件和 Vue 很像：

```javascript
// Vue 组件
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
  // 没有 computed，需要手动更新
  onLoad() {
    this.loadData();
  }, // ≈ mounted
  onShow() {}, // 每次显示时触发
  increment() {
    this.setData({ count: this.data.count + 1 }); // 必须用 setData
  },
  async loadData() {
    const res = await wx.request({ url: "..." });
    this.setData({ list: res.data });
  },
});
```

## 不同的地方

### 1. 没有 DOM，不能用 Web API

```javascript
// ❌ 小程序里这些都不能用
document.getElementById("xxx");
window.localStorage;
XMLHttpRequest;
fetch;

// ✅ 用小程序提供的 API
wx.request({ url, method, data, success, fail }); // 网络请求
wx.setStorageSync("key", value); // 本地存储
wx.showToast({ title: "成功" }); // Toast 提示
```

### 2. 路由方式

```javascript
// 小程序路由
wx.navigateTo({ url: "/pages/detail/detail?id=123" }); // 跳转（可返回）
wx.redirectTo({ url: "/pages/home/home" }); // 替换（不可返回）
wx.navigateBack({ delta: 1 }); // 返回
wx.switchTab({ url: "/pages/index/index" }); // 跳转 tabBar 页面

// URL 传参（只能是字符串）
// 接收：onLoad(options) { const id = options.id }
```

### 3. 组件生命周期

```javascript
// 比 Web 多了几个：
onLoad(options); // 页面加载，只执行一次，options 是路由参数
onShow(); // 页面显示（从后台/其他页面回来也触发）
onHide(); // 页面隐藏
onUnload(); // 页面卸载（navigateTo 不触发，redirectTo 触发）
onPullDownRefresh(); // 下拉刷新
onReachBottom(); // 触底加载更多
```

### 4. 样式限制

```css
/* 小程序用 rpx（responsive pixel）作为单位 */
/* 750rpx = 屏幕宽度 → 1rpx ≈ 0.5px（iPhone 6） */
.container {
  width: 750rpx; /* 全屏宽 */
  padding: 24rpx;
  font-size: 28rpx;
}

/* 不支持：* 选择器、标签选择器（限制） */
/* 支持：类选择器、ID 选择器、伪类 */
```

### 5. wxs：模板里的逻辑

小程序模板里不能直接调用 methods，需要用 wxs：

```html
{% raw %}
<!-- WXML -->
<wxs module="utils" src="./utils.wxs"></wxs>
<view>{{ utils.formatDate(date) }}</view>
{% endraw %}
```

```javascript
// utils.wxs（不是 JS！有语法限制）
var formatDate = function (date) {
  return date.substring(0, 10);
};
module.exports = { formatDate: formatDate };
```

## 推荐工具

- **uni-app**：一套代码发布到多端（小程序/H5/App）
- **Taro**：类 React 语法，编译到各端
- **WePY**：类 Vue 语法的小程序框架

如果项目只针对微信小程序，原生开发就够用。如果需要多端，uni-app 或 Taro 值得考虑。

## 小结

- 小程序和 Vue 设计理念相似，有 Web 基础上手快
- 最大差异：没有 DOM/BOM，所有 API 都是 `wx.*`
- 用 `setData` 触发视图更新，不能直接修改 `data`
- rpx 是小程序专用单位，750rpx = 屏幕全宽
