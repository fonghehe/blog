---
title: "微前端初探：当项目大到一个人管不动时"
date: 2018-10-15 10:10:23
tags:
  - 微前端
  - 工程化
readingTime: 6
description: "我们的后台管理系统是三年前用 Vue 2 搭的，最开始只有几个页面，体验很好。但三年过去，它已经变成了一个庞然大物："
wordCount: 1561
---

## 问题背景

我们的后台管理系统是三年前用 Vue 2 搭的，最开始只有几个页面，体验很好。但三年过去，它已经变成了一个庞然大物：

- 50+ 路由页面
- 200+ 个组件
- 3 个团队共 12 个人同时在上面开发
- Webpack 构建 4 分钟起步
- 主包体积 3MB+，首屏加载越来越慢

更要命的是，每次发版都是全量发布。订单模块改了个文案，整个系统都得重新部署。上周库存模块上线了一个 bug，直接把整个后台搞挂了，跟我们用户模块半毛钱关系没有，但大家的工单系统全崩了。

团队里有人开玩笑说："这项目已经不是一个人能管得动的了。" 其实不是玩笑。

## 什么是微前端

微前端这个概念，本质上是把后端微服务的思想搬到前端。

后端早就经历了从单体到微服务的拆分——把一个大的 Java 应用拆成多个独立部署的服务，每个服务有自己的数据库、自己的发布节奏。前端现在也走到了这一步。

核心思路：

```
传统单体 SPA：
┌─────────────────────────────────────┐
│           单体前端应用               │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 用户  │ │ 订单  │ │ 库存  │        │
│  └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
一个代码仓库，一个构建产物，一个部署单元

微前端：
┌─────────────────────────────────────┐
│           主应用（Shell）             │
│  ┌──────────┐ ┌──────────┐          │
│  │ 用户子应用 │ │ 订单子应用 │          │
│  │ 独立仓库  │ │ 独立仓库  │          │
│  │ 独立部署  │ │ 独立部署  │          │
│  └──────────┘ └──────────┘          │
└─────────────────────────────────────┘
各模块独立开发、独立构建、独立部署
```

每个子应用可以有自己的技术栈、自己的发布周期，团队之间互不干扰。

## 现有方案对比

在动手之前，我花了一周时间调研了几种方案。

### 方案一：iframe

最古老也最直接的方式。主应用提供导航框架，子应用通过 iframe 加载。

```html
<!-- 主应用 shell -->
<div id="layout">
  <sidebar-nav />
  <main>
    <iframe :src="currentAppUrl" frameborder="0"></iframe>
  </main>
</div>
```

优点是隔离性极好——样式、JS、全局变量完全独立。缺点也很明显：路由同步困难，弹窗被 iframe 边界截断，页面间通信只能靠 `postMessage`，而且 iframe 内的加载体验比较差。

### 方案二：Nginx 路由分发

不同路径转发到不同的前端应用部署：

```nginx
location /user/ {
  proxy_pass http://user-app-server/;
}
location /order/ {
  proxy_pass http://order-app-server/;
}
```

简单粗暴，但路径切换时整页刷新，体验不好。而且公共部分（导航栏、用户信息）每个子应用都得重复实现一遍。

### 方案三：npm 包拆分

把公共模块抽成 npm 包，各业务团队维护自己的仓库，最终在主应用中组装。

这种方式对构建流程改动最小，但本质上并没有解决独立部署的问题——任何一个模块更新，主应用还是得重新构建发布。

### 方案四：single-spa

最近关注到的一个项目叫 [single-spa](https://single-spa.js.org/)，它提供了一个运行时框架，让多个前端应用可以在同一个页面共存，通过生命周期管理来协调挂载和卸载：

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

子应用需要暴露 `bootstrap`、`mount`、`unmount` 三个生命周期钩子。思路很好，但目前社区还不大，文档也比较简陋，对 Vue 的支持需要额外适配。感觉是个有前途的方向，但现阶段直接上生产环境风险不小。

## 我们的尝试：iframe 方案 PoC

考虑到团队当前的技术储备和风险承受能力，我们决定先用最保守的 iframe 方案做一个 PoC，把用户管理模块从主应用中拆出来。

整体架构：

```
┌────────────────────────────────────────────┐
│  主应用 Shell（Vue 2）                       │
│  ┌──────────────────────────────────────┐  │
│  │  顶部导航 + 侧边栏                    │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │  <iframe :src="userAppUrl" />        │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
        │                        │
        ▼                        ▼
   主应用部署                  用户子应用部署
（其他 40+ 页面）          （Vue 2, 独立仓库）
```

关键问题是如何共享登录态。我们的做法是：主应用登录后把 token 写入 cookie（设 domain 为 `.company.com`），子应用从 cookie 中读取：

```javascript
// 主应用：登录成功后
document.cookie = `auth_token=${token}; domain=.company.com; path=/`;

// 子应用：启动时读取
function getAuthToken() {
  const match = document.cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

// 子应用：发起请求时带上 token
axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

子应用之间通过 `postMessage` 通信：

```javascript
// 主应用 → 子应用：传递用户信息
iframe.contentWindow.postMessage(
  { type: "USER_INFO", payload: { userId: 123, role: "admin" } },
  "https://user.company.com",
);

// 子应用监听
window.addEventListener("message", (event) => {
  if (event.data.type === "USER_INFO") {
    store.commit("setUserInfo", event.data.payload);
  }
});

// 子应用 → 主应用：触发路由跳转
window.parent.postMessage(
  { type: "NAVIGATE", payload: "/order/detail/456" },
  "https://admin.company.com",
);
```

## 踩过的坑

做 PoC 的过程中踩了不少坑，说几个印象深刻的。

**1. iframe 高度自适应**

iframe 默认不会根据内容撑高，设 `height: 100%` 会出现双滚动条。我们的做法是子应用通过 `postMessage` 告诉主应用自己的内容高度：

```javascript
// 子应用：内容变化时通知主应用
const observer = new ResizeObserver(() => {
  window.parent.postMessage(
    { type: "RESIZE", height: document.body.scrollHeight },
    "*",
  );
});
observer.observe(document.body);

// 主应用：接收高度并设置 iframe 样式
window.addEventListener("message", (event) => {
  if (event.data.type === "RESIZE") {
    iframe.style.height = event.data.height + "px";
  }
});
```

**2. 弹窗和遮罩层被截断**

iframe 内的 Modal 或 Toast 会被限制在 iframe 边界内，无法覆盖整个屏幕。这是 iframe 方案最头疼的问题。我们的妥协是：弹窗在主应用中实现，子应用通过 `postMessage` 请求主应用弹窗。但这增加了耦合。

**3. 浏览器前进/后退**

iframe 内的路由变化不会被浏览器历史记录捕获。需要主应用和子应用的路由做同步——子应用路由变化时通知主应用，主应用更新 URL query 参数，iframe 再根据 query 参数跳转。逻辑绕了好几层，代码不太好维护。

## 什么时候该用微前端

说了这么多坑，是不是微前端就不值得做？也不是。但确实不是所有项目都需要。

**适合的场景：**

- 多个团队维护同一个大型前端应用，协作冲突频繁
- 不同模块需要独立发版，降低发布风险
- 遗留系统需要渐进式迁移（比如从 jQuery 迁到 Vue）
- 模块之间边界清晰，交互相对简单

**不适合的场景：**

- 项目不大，两三个人就能维护——别过度设计
- 模块之间有大量复杂的联动交互——拆分后的通信成本会很高
- 团队没有 DevOps 基础设施支撑多仓库、多部署流水线

说白了，微前端解决的是组织问题（多人协作、独立交付），而不是纯技术问题。如果你们团队没有被单体应用"卡脖子"，那就别急着上微前端。

## 小结

- 微前端把后端微服务思想引入前端，让大型应用的各模块可以独立开发、独立部署
- 2018 年的主流方案有 iframe、Nginx 路由分发、npm 包拆分、JS 运行时集成
- iframe 方案最简单、隔离性最好，但路由同步、弹窗截断、通信成本是硬伤
- single-spa 是一个有潜力的运行时集成框架，但目前还不太成熟，值得关注但需谨慎采用
- 微前端本质上解决的是团队协作和独立交付的组织问题，小项目不需要
- 如果决定做，建议从一个边界清晰的模块开始 PoC，别一上来就全量拆分
