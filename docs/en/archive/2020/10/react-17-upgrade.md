---
title: "React 17 Upgrade Guide"
date: 2020-10-20 11:02:59
tags:
  - React
readingTime: 2
description: "React 17 was just released, and the team calls it the 'no new features' version. That sounds dull, but it actually lays important groundwork for React's future. Here's a rundown of the upgrade essentials."
wordCount: 183
---

React 17 was just released, and the team calls it the 'no new features' version. That sounds dull, but it actually lays important groundwork for React's future. Here's a rundown of the upgrade essentials.

## No New APIs, but Important Changes

The core changes in React 17:

1. **Event delegation no longer binds to document**: now binds to the root DOM node instead
2. **Event pooling removed**: SyntheticEvent no longer needs `event.persist()`
3. **New JSX Transform**: no longer requires `import React`
4. **Gradual upgrades**: supports running two versions of React on the same page

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

- React 17 is a "bridge release" that lays the groundwork for future features such as Concurrent Mode.
- Event delegation now binds to the root DOM, which resolves the multi-version coexistence problem.
- Removing the event pool makes the code cleaner — `persist()` is no longer needed.
- The new JSX Transform removes the need for `import React from 'react'`.
- The upgrade itself has minimal impact, and most projects can migrate smoothly.
