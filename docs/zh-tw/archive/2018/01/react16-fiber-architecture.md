---
title: "React 16 Fiber 架構解析：為什麼重寫了渲染引擎"
date: 2018-01-25 11:10:29
tags:
  - React
readingTime: 4
description: "React 16 在 2017 年 9 月發布，底層做了徹底重寫，核心就是 Fiber 架構。這次重寫不是為了效能數字好看，而是為了解決 React 15 在複雜應用裡的根本性架構問題。"
---

React 16 在 2017 年 9 月發布，底層做了徹底重寫，核心就是 Fiber 架構。這次重寫不是為了效能數字好看，而是為了解決 React 15 在複雜應用裡的根本性架構問題。

## React 15 的問題：同步不可中斷的渲染

React 15 的渲染過程是同步的、遞迴的：一旦開始渲染（呼叫 `setState`），就必須一口氣走完整個元件樹的 diff 和更新，期間無法暫停。

瀏覽器的主執行緒同時負責 JS 執行、頁面渲染、回應使用者輸入。如果 React 的渲染佔用主執行緒超過 16ms（60fps 的單幀預算），下一幀的渲染就會延遲，使用者會感知到卡頓。

對於元件樹規模不大的應用，16ms 通常夠用。但當樹很深或更新頻繁時，這個同步阻塞就成了瓶頸。

## Fiber 的核心思想：把渲染拆成可中斷的工作單元

Fiber 這個名字來自作業系統裡的「纖程」概念——比執行緒更細粒度的工作單元。Fiber 架構把渲染過程拆分成兩個階段：

**階段一：Reconciliation（協調／可中斷）**

- 遍歷元件樹，計算需要哪些變更（diff）
- 這個階段可以被暫停、恢復、甚至丟棄
- 不會修改真實 DOM

**階段二：Commit（提交／同步不可中斷）**

- 把計算好的變更批次套用到真實 DOM
- 必須同步完成，確保 UI 一致性

階段一可以利用瀏覽器閒置時間分批執行：

```
幀1: [React渲染部分] → [瀏覽器繪製] → [React繼續渲染] ...
幀2: [React渲染剩餘] → [瀏覽器繪製] → [提交DOM變更]
```

這樣 React 不再獨佔主執行緒，高優先級任務（使用者輸入、動畫）可以插隊。

## Fiber 節點結構

每個 React 元件對應一個 Fiber 節點，Fiber 把原來的遞迴呼叫堆疊「平鋪」成了一個鏈結串列：

```
虛擬 DOM 樹：         Fiber 鏈結串列結構：
    App                App
   /   \               ↓ child
 Foo   Bar     →     Foo → Bar
  |                   ↓ child
 Baz               Baz (sibling → Bar, return → Foo)
```

每個 Fiber 節點包含：

- `type`：元件型別
- `stateNode`：對應的 DOM 節點或元件實例
- `child`：第一個子 Fiber
- `sibling`：下一個兄弟 Fiber
- `return`：父 Fiber
- `pendingProps` / `memoizedProps`：新舊 props
- `effectTag`：需要執行的 DOM 操作（Insert、Update、Delete）

用鏈結串列代替遞迴呼叫堆疊，使得「儲存當前進度，下次繼續」成為可能。

## 優先級排程

Fiber 引入了任務優先級的概念：

```javascript
// React 內部的優先級層級（簡化）
const priorities = {
  Synchronous: 1, // 同步，例如 setState 在事件處理裡
  Task: 2, // 當前 tick 內
  Animation: 3, // 下一幀前
  High: 4, // 快，但不是立刻
  Low: 5, // 可以等
  Offscreen: 6, // 隱藏內容，最低優先級
};
```

高優先級更新（如使用者輸入觸發的狀態變更）可以中斷低優先級更新（如資料請求後的清單渲染）。

## 對開發者的影響：生命週期變化

Fiber 的分階段渲染有個副作用：階段一（協調階段）可能被執行多次（因為可以被中斷重來）。這意味著某些生命週期函式可能被呼叫多次：

**協調階段（可能多次呼叫）：**

- `componentWillMount`
- `componentWillReceiveProps`
- `componentWillUpdate`
- `shouldComponentUpdate`
- `render`

**提交階段（只呼叫一次）：**

- `componentDidMount`
- `componentDidUpdate`
- `componentWillUnmount`

正因為如此，React 16 開始不推薦在協調階段的生命週期裡做副作用（API 呼叫、手動 DOM 操作）。React 在 16.3 會給這些生命週期加上 `UNSAFE_` 前綴作為警告，最終在 17+ 版本廢棄。

## 現在能用上 Fiber 的哪些特性

React 16.0 的 Fiber 排程能力還沒有完全開放，同步優先級之外的非同步排程還在開發中。已經可以使用的是：

- **Error Boundaries**：`componentDidCatch`
- **`createPortal`**：把子元件渲染到任意 DOM 節點（做 Modal 很方便）
- **`render` 返回陣列和字串**：不再強制要求單根元素

```javascript
// render 可以返回陣列，不需要多餘的包裹 div
render() {
  return [
    <li key="1">Item 1</li>,
    <li key="2">Item 2</li>,
    <li key="3">Item 3</li>
  ]
}

// createPortal：把 Modal 渲染到 body 上，避免 z-index 和 overflow 問題
import { createPortal } from 'react-dom'

class Modal extends React.Component {
  render() {
    return createPortal(
      <div className="modal">{this.props.children}</div>,
      document.body
    )
  }
}
```

Fiber 架構的完整潛力（Concurrent Mode、Suspense）會在後續版本逐步釋放。

---

_下一篇：Babel 7 升級遷移實戰_
