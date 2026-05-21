---
title: "React 17 升級指南"
date: 2020-10-20 11:02:59
tags:
  - React
readingTime: 2
description: "React 17 剛發佈，官方稱之為\"沒有新特性\"的版本。聽起來無聊，但實際上它為 React 的未來打下了重要基礎。梳理一下升級要點。"
wordCount: 263
---

React 17 剛發佈，官方稱之為"沒有新特性"的版本。聽起來無聊，但實際上它為 React 的未來打下了重要基礎。梳理一下升級要點。

## 沒有新 API，但有重要變化

React 17 的核心變化：

1. **事件委託不再綁定到 document**：改綁定到 root DOM 節點
2. **移除事件池**：SyntheticEvent 不再需要 `event.persist()`
3. **新的 JSX Transform**：不再需要 `import React`
4. **漸進式升級**：支持一個頁面中同時運行兩個版本的 React

## 事件系統變化

```javascript
// React 16：事件委託到 document
// <div id="root">...</div>
// 事件監聽器綁在 document 上

// React 17：事件委託到 root DOM
// <div id="root">...</div>
// 事件監聽器綁在 #root 上

// 影響：
// 1. 多個 React 版本共存時事件不會串
// 2. 嵌入到非 React 應用時更容易
// 3. 逐步遷移成為可能
```

## 事件池被移除

```javascript
// React 16：事件對象被池化，異步訪問需要 persist
function handleClick(e) {
  console.log(e.type); // 'click'
  setTimeout(() => {
    console.log(e.type); // undefined（已回收）
  }, 100);
}

// React 16 的修復
function handleClick(e) {
  e.persist(); // 保留事件對象
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

## 新的 JSX Transform

```javascript
// React 16：Babel 編譯 JSX 需要 React 在作用域內
import React from 'react'; // 必須有這行

function App() {
  return <div>Hello</div>;
}
// 編譯為：
// React.createElement('div', null, 'Hello');

// React 17：自動導入，不需要 import React
// 不需要 import React from 'react'

function App() {
  return <div>Hello</div>;
}
// 編譯為：
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

## useEffect 清理時機變化

```javascript
// React 16：useEffect 清理函數在 componentDidUpdate 之後同步運行
// React 17：useEffect 清理函數異步運行（useEffect 返回時）

// 對於大多數代碼沒有影響
// 但如果 effect 和 layout effect 有依賴關係需要注意

useEffect(() => {
  // 這個 effect
  return () => {
    // 清理函數在 React 17 中是異步運行的
    // 但通常不需要關心這個
  };
}, []);

// 如果確實需要同步清理，用 useLayoutEffect
useLayoutEffect(() => {
  return () => {
    // 同步運行
  };
}, []);
```

## 升級步驟

```bash
# 1. 更新依賴
npm install react@17 react-dom@17

# 2. 更新 Babel（如果用新的 JSX Transform）
npm install @babel/preset-react@latest
npm install @babel/core@latest

# 3. 運行代碼檢查
npx eslint src/ --ext .js,.jsx,.ts,.tsx

# 4. 運行測試
npm test
```

```bash
# 使用官方升級腳本自動修復
npx react-codemod update-react-imports

# 這個腳本會：
# - 移除不需要的 import React from 'react'
# - 保留確實需要 React 的 import（如 React.Component）
```

## 兼容性問題排查

```javascript
// 1. 依賴了 React 在全局作用域的代碼會出問題
// 確保每個用到 React 的文件都有 import

// 2. React Native 還不支持 React 17
// 等待 React Native 更新

// 3. 第三方庫兼容性
// 大部分庫兼容，但可能需要更新版本

// 檢查命令
npx react-codemod React-PropTypes-to-prop-types
```

## 漸進式升級

```javascript
// React 17 支持一個頁面運行多個 React 版本
// 這意味着可以逐步遷移子應用

// 子應用 A：React 16
// 子應用 B：React 17
// 事件系統不再衝突

// 實際場景：微前端架構下的漸進升級
// 不需要一次性全部升級
```

## 小結

- React 17 是"橋樑版本"，為未來併發模式等特性打基礎
- 事件委託改綁到 root DOM，解決了多版本共存問題
- 事件池移除讓代碼更簡潔，不再需要 `persist()`
- 新 JSX Transform 不再需要 `import React from 'react'`
- 升級本身影響很小，大部分項目可以平滑升級
