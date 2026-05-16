---
title: "WeChat Mini Program Development: Differences from Web"
date: 2018-09-24 15:29:30
tags:
  - Frontend
readingTime: 2
description: "I recently picked up a WeChat Mini Program project. Having a web background made the learning curve manageable, but there are plenty of things to adapt to."
---

I recently picked up a WeChat Mini Program project. Having a web background made the learning curve manageable, but there are plenty of things to adapt to.

## What's Similar

Mini Program components are very similar to Vue:

```javascript
// Vue component
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
// Mini Program Page
Page({
  data: {
    count: 0,
    list: [],
  },
  // No computed — manual updates required
  onLoad() {
    this.loadData();
  }, // ≈ mounted
  onShow() {}, // Fires every time the page is shown
  increment() {
    this.setData({ count: this.data.count + 1 }); // Must use setData
  },
  async loadData() {
    const res = await wx.request({ url: "..." });
    this.setData({ list: res.data });
  },
});
```

## What's Different

### 1. No DOM — Web APIs Unavailable

```javascript
// ❌ These don't work in Mini Programs
document.getElementById("xxx");
window.localStorage;
XMLHttpRequest;
fetch;

// ✅ Use the Mini Program APIs
wx.request({ url, method, data, success, fail }); // Network request
wx.setStorageSync("key", value); // Local storage
wx.showToast({ title: "Success" }); // Toast notification
```

### 2. Routing

```javascript
// Mini Program routing
wx.navigateTo({ url: "/pages/detail/detail?id=123" }); // Navigate (back allowed)
wx.redirectTo({ url: "/pages/home/home" }); // Replace (back not allowed)
wx.navigateBack({ delta: 1 }); // Go back
wx.switchTab({ url: "/pages/index/index" }); // Switch tabBar page

// URL params (strings only)
// Receiving: onLoad(options) { const id = options.id }
```

### 3. Component Lifecycle

```javascript
// A few extra compared to the web:
onLoad(options); // Page load, runs once, options are route params
onShow(); // Page shown (also fires when returning from background/other pages)
onHide(); // Page hidden
onUnload(); // Page unloaded (not triggered by navigateTo, triggered by redirectTo)
onPullDownRefresh(); // Pull-down refresh
onReachBottom(); // Reached bottom (load more)
```

### 4. Style Restrictions

```css
/* Mini Programs use rpx (responsive pixel) */
/* 750rpx = screen width → 1rpx ≈ 0.5px (iPhone 6) */
.container {
  width: 750rpx; /* full-screen width */
  padding: 24rpx;
  font-size: 28rpx;
}

/* Not supported: * selector, tag selectors (limited) */
/* Supported: class selectors, ID selectors, pseudo-classes */
```

### 5. WXS: Logic in Templates

Mini Program templates can't call methods directly — use WXS:

```html
{% raw %}
<!-- WXML -->
<wxs module="utils" src="./utils.wxs"></wxs>
<view>{{ utils.formatDate(date) }}</view>
{% endraw %}
```

```javascript
// utils.wxs (not JS! syntax is restricted)
var formatDate = function (date) {
  return date.substring(0, 10);
};
module.exports = { formatDate: formatDate };
```

## Recommended Tools

- **uni-app**: one codebase for multiple platforms (Mini Program / H5 / App)
- **Taro**: React-like syntax, compiles to all platforms
- **WePY**: Vue-like syntax for Mini Programs

If the project targets only WeChat Mini Program, native development is sufficient. For multi-platform needs, uni-app or Taro is worth considering.

## Summary

- Mini Programs share design philosophy with Vue — easy to pick up with web experience
- Biggest difference: no DOM/BOM, all APIs are `wx.*`
- Use `setData` to trigger view updates — can't modify `data` directly
- rpx is Mini Program's own unit: 750rpx = full screen width
