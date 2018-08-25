---
title: "Webpack HMR 热更新原理"
date: 2018-08-25 09:35:16
tags:
  - Webpack
  - 工程化
---

开发时修改代码，页面自动更新，这是 HMR（Hot Module Replacement）。平时用得理所当然，今天研究了一下原理。

## HMR 的整体流程

```
1. Webpack 监听文件变化（watch 模式）
2. 文件变化 → 重新编译变化的模块
3. 编译完成 → 通过 WebSocket 通知浏览器（发送 hash）
4. 浏览器收到通知 → 向 dev server 请求更新的模块（manifest + chunk）
5. 浏览器接收新模块 → HMR Runtime 替换旧模块
6. 如果替换成功 → 局部更新，页面不刷新
7. 如果替换失败 → 强制刷新整个页面（fallback）
```

## webpack-dev-server 的角色

```javascript
// webpack-dev-server 做了两件事：
// 1. 启动 HTTP 服务（伺服静态资源）
// 2. 启动 WebSocket 服务（推送更新通知）

// 浏览器端注入的 HMR 客户端代码（bundle 里包含了这段）
// 建立 WebSocket 连接，监听 webpack 的编译事件
const socket = new WebSocket("ws://localhost:8080");
socket.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  if (type === "hash") {
    currentHash = data; // 记录最新 hash
  }
  if (type === "ok") {
    // 编译完成，请求更新
    checkForUpdates();
  }
};
```

## 模块替换的实现

```javascript
// webpack 编译后的模块都注册在 __webpack_modules__ 对象中
// HMR Runtime 替换就是替换这个对象中的对应函数

// 假设 foo.js 修改了：
__webpack_modules__["./src/foo.js"] = function (module, exports) {
  // 这里是新的 foo.js 代码
};

// 然后通知依赖 foo.js 的模块重新执行
// 如果有模块处理了 hot.accept，局部更新
// 否则向上冒泡，直到有模块处理或触发整页刷新
```

## module.hot.accept：局部热替换

```javascript
// 在模块里声明接受自身的热更新
if (module.hot) {
  module.hot.accept("./utils", () => {
    // utils.js 更新后，这里的回调被调用
    const newUtils = require("./utils");
    updateUI(newUtils);
  });
}
```

Vue 和 React 的 HMR 之所以"自动"，是因为 vue-loader 和 react-refresh 自动帮你注入了 `module.hot.accept` 逻辑。

## vue-loader 怎么处理 HMR

```javascript
// vue-loader 编译后，大致注入了这样的代码：
if (module.hot) {
  module.hot.accept(); // 接受自身更新

  if (!isFirstRender) {
    // 用新的组件选项替换旧的
    const newOptions = require("./MyComponent.vue");
    component.options = newOptions;

    // 强制重新渲染
    component.__vue_hot__ = Date.now();
  }
}
```

## 保留状态的 HMR

Vue 的 HMR 会保留组件状态（data），只更新模板和方法。

```javascript
// 修改 MyComponent.vue 的 template
// HMR 后：data 里的值不变，只有视图更新

// ❌ 但这种情况会重置状态（不得不如此）：
// - 修改了 data 的初始值
// - 修改了 created/mounted 钩子
```

## CSS 的 HMR

CSS 更简单，style-loader 会直接替换 `<style>` 标签：

```javascript
// style-loader 注入的 HMR 代码
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // 移除旧的 style 标签
    styleElement.remove();
  });
  // 添加新的 style 标签
}
```

## 小结

- HMR 通过 WebSocket 推送更新通知，再 HTTP 拉取新模块
- 模块替换是更新 `__webpack_modules__` 中对应的函数
- `module.hot.accept` 声明接受热更新，vue-loader/react-refresh 自动注入
- CSS 热更新直接替换 style 标签，无状态问题
- 替换失败时 fallback 为整页刷新
