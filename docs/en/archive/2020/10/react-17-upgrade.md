---
title: "React 17 Upgrade Guide"
date: 2020-10-20 11:02:59
tags:
  - React
readingTime: 2
description: "React 17 刚发布，官方称之为\"没有新特性\"的版本。听起来无聊，但实际上它为 React 的未来打下了重要基础。梳理一下升级要点。"
---

React 17 刚发布，官方称之为"没有新特性"的版本。听起来无聊，但实际上它为 React 的未来打下了重要基础。梳理一下升级要点。

## No New APIs, but Important Changes

React 17 的核心变化：

1. **事件委托不再绑定到 document**：改绑定到 root DOM 节点
2. **移除事件池**：SyntheticEvent 不再需要 `event.persist()`
3. **新的 JSX Transform**：不再需要 `import React`
4. **渐进式升级**：支持一个页面中同时运行两个版本的 React

## Event System Changes

```javascript
// React 16：事件委托到 document
// <div id="root">...</div>
// 事件监听器绑在 document 上

// React 17：事件委托到 root DOM
// <div id="root">...</div>
// 事件监听器绑在 #root 上

// 影响：
// 1. 多个 React 版本共存时事件不会串
// 2. 嵌入到非 React 应用时更容易
// 3. 逐步迁移成为可能
```

## Event Pooling Removed

```javascript
// React 16：事件对象被池化，异步访问需要 persist
function handleClick(e) {
  console.log(e.type); // 'click'
  setTimeout(() => {
    console.log(e.type); // undefined（已回收）
  }, 100);
}

// React 16 的修复
function handleClick(e) {
  e.persist(); // 保留事件对象
  setTimeout(() => {
    console.log(e.type); // 'click'
  }, 100);
}

// React 17：不再需要 persist
function handleClick(e) {
  console.log(e.type); // 'click'
  setTimeout(() => {
    console.log(e.type); // 'click'（正常工作）
  }, 100);
}
```

## New JSX Transform

```javascript
// React 16：Babel 编译 JSX 需要 React 在作用域内
import React from 'react'; // 必须有这行

function App() {
  return <div>Hello</div>;
}
// 编译为：
// React.createElement('div', null, 'Hello');

// React 17：自动导入，不需要 import React
// 不需要 import React from 'react'

function App() {
  return <div>Hello</div>;
}
// 编译为：
// import { jsx as _jsx } from 'react/jsx-runtime';
// _jsx('div', { children: 'Hello' });
```

```bash
# Babel 配置
# .babelrc
{
  "presets": [
    ["@babel/preset-react", {
      "runtime": "automatic"  // 新的 JSX Transform
    }]
  ]
}
```

## useEffect Cleanup Timing Changes

```javascript
// React 16：useEffect 清理函数在 componentDidUpdate 之后同步运行
// React 17：useEffect 清理函数异步运行（useEffect 返回时）

// 对于大多数代码没有影响
// 但如果 effect 和 layout effect 有依赖关系需要注意

useEffect(() => {
  // 这个 effect
  return () => {
    // 清理函数在 React 17 中是异步运行的
    // 但通常不需要关心这个
  };
}, []);

// 如果确实需要同步清理，用 useLayoutEffect
useLayoutEffect(() => {
  return () => {
    // 同步运行
  };
}, []);
```

## Upgrade Steps

```bash
# 1. 更新依赖
npm install react@17 react-dom@17

# 2. 更新 Babel（如果用新的 JSX Transform）
npm install @babel/preset-react@latest
npm install @babel/core@latest

# 3. 运行代码检查
npx eslint src/ --ext .js,.jsx,.ts,.tsx

# 4. 运行测试
npm test
```

```bash
# 使用官方升级脚本自动修复
npx react-codemod update-react-imports

# 这个脚本会：
# - 移除不需要的 import React from 'react'
# - 保留确实需要 React 的 import（如 React.Component）
```

## Compatibility Issue Troubleshooting

```javascript
// 1. 依赖了 React 在全局作用域的代码会出问题
// 确保每个用到 React 的文件都有 import

// 2. React Native 还不支持 React 17
// 等待 React Native 更新

// 3. 第三方库兼容性
// 大部分库兼容，但可能需要更新版本

// 检查命令
npx react-codemod React-PropTypes-to-prop-types
```

## Gradual Upgrade

```javascript
// React 17 支持一个页面运行多个 React 版本
// 这意味着可以逐步迁移子应用

// 子应用 A：React 16
// 子应用 B：React 17
// 事件系统不再冲突

// 实际场景：微前端架构下的渐进升级
// 不需要一次性全部升级
```

## Summary

- React 17 是"桥梁版本"，为未来并发模式等特性打基础
- 事件委托改绑到 root DOM，解决了多版本共存问题
- 事件池移除让代码更简洁，不再需要 `persist()`
- 新 JSX Transform 不再需要 `import React from 'react'`
- 升级本身影响很小，大部分项目可以平滑升级
