---
title: "微前端落地实践：基于 single-spa"
date: 2019-07-12 10:26:31
tags:
  - 微前端
  - 工程化
---

公司的老后台系统是 2016 年的 jQuery 项目，新功能想用 Vue，但不能全量重写。微前端解决了这个问题。

## 我们的场景

- 老系统：jQuery + Bootstrap，几十个页面
- 新需求：新模块要用 Vue CLI 3 开发
- 目标：新老共存，逐步迁移，统一导航

## 为什么选 single-spa

2019 年微前端框架不多：

- single-spa：最成熟，支持多框架
- qiankun（阿里）：基于 single-spa，API 更友好（我们调研时还没到 1.0）

最终选了 single-spa。

## 架构设计

```
主应用（Shell）
├── 公共导航、权限管理、路由注册
├── 子应用 A（Legacy jQuery）- /legacy/*
├── 子应用 B（Vue 2）- /orders/*
└── 子应用 C（Vue 2）- /analytics/*
```

## 主应用（Shell）

```javascript
// shell/src/index.js
import { registerApplication, start } from "single-spa";

// 注册旧系统（jQuery）
registerApplication(
  "legacy",
  () => import("./apps/legacy-app"), // 加载函数
  (location) => location.pathname.startsWith("/legacy"), // 激活条件
);

// 注册 Vue 子应用
registerApplication(
  "orders",
  () => System.import("http://localhost:8081/orders-app.js"),
  (location) => location.pathname.startsWith("/orders"),
);

registerApplication(
  "analytics",
  () => System.import("http://localhost:8082/analytics-app.js"),
  (location) => location.pathname.startsWith("/analytics"),
);

// 启动
start();
```

## Vue 子应用适配

```javascript
// orders-app/src/main.js
import Vue from "vue";
import App from "./App.vue";
import router from "./router";

let vueInstance = null;

// single-spa 生命周期
export async function bootstrap() {
  console.log("orders app bootstrapped");
}

export async function mount(props) {
  // props 包含主应用传递的数据（用户信息、全局状态等）
  const { container, userInfo } = props;

  vueInstance = new Vue({
    router,
    render: (h) => h(App, { props: { userInfo } }),
  }).$mount(container || "#orders-container");
}

export async function unmount() {
  vueInstance.$destroy();
  vueInstance.$el.innerHTML = "";
  vueInstance = null;
}
```

## 样式隔离

```javascript
// 方案 1：CSS Modules（推荐）
// 构建时自动 hash 化类名，天然隔离

// 方案 2：BEM 命名约定
.orders-module__header { }
.orders-module__content { }

// 方案 3：Shadow DOM（侵入性最低，但 IE 不支持）
// qiankun 的 experimentalStyleIsolation 用的这个方案
```

## 子应用间通信

```javascript
// shell/src/eventBus.js（全局事件总线）
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback); // 返回取消订阅函数
  }

  emit(event, data) {
    this.events[event]?.forEach((cb) => cb(data));
  }

  off(event, callback) {
    this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
  }
}

// 挂载到 window（子应用通过 window 访问）
window.__MICRO_APP_BUS__ = new EventBus();

// 子应用中使用
window.__MICRO_APP_BUS__.emit("user:logout", {});
window.__MICRO_APP_BUS__.on("theme:change", (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
});
```

## 踩过的坑

1. **全局变量污染**：子应用卸载时要清理注册的全局变量、事件监听
2. **CSS 全局污染**：第三方 UI 库（Element UI）的全局样式会互相影响
3. **路由冲突**：子应用路由要用 `base` 配置，和主应用路由不冲突
4. **依赖重复**：每个子应用都打包 Vue，体积大。可以用 CDN 共享

## 我们的迁移路线

第一阶段（3 个月）：新功能模块用 Vue 开发，通过微前端挂载
第二阶段（6 个月）：把高频访问的旧页面逐步迁移到 Vue 子应用
第三阶段（长期）：老系统功能全部迁完后，Legacy 子应用下线

## 小结

- 微前端适合"大型遗留系统渐进迁移"或"多团队并行开发"
- single-spa 的核心是注册子应用和生命周期（bootstrap/mount/unmount）
- 样式隔离推荐 CSS Modules，子应用通信用全局事件总线
- 常见坑：全局变量污染、CSS 污染、路由冲突
