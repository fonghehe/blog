---
title: "React 16 Fiber 架構解析：點解要重寫渲染引擎"
date: 2018-01-25 11:10:29
tags:
  - React
readingTime: 3
description: "React 16 喺 2017 年 9 月發布，底層做咗徹底重寫，核心就係 Fiber 架構。呢次重寫唔係為咗性能數字好睇，而係為咗解決 React 15 喺複雜應用裡面嘅根本性架構問題。"
---

React 16 喺 2017 年 9 月發布，底層做咗徹底重寫，核心就係 Fiber 架構。呢次重寫唔係為咗性能數字好睇，而係為咗解決 React 15 喺複雜應用裡面嘅根本性架構問題。

## React 15 嘅問題：同步唔可中斷嘅渲染

React 15 嘅渲染過程係同步嘅、遞歸嘅：一旦開始渲染（調用 `setState`），就必須一口氣走完整個組件樹嘅 diff 同更新，期間無法暫停。

瀏覽器嘅主線程同時負責 JS 執行、頁面渲染、響應用戶輸入。如果 React 嘅渲染佔用主線程超過 16ms（60fps 嘅單幀預算），下一幀嘅渲染就會推遲，用戶會感知到卡頓。

對於組件樹規模唔大嘅應用，16ms 通常夠用。但當樹好深或更新頻繁時，呢個同步阻塞就成咗瓶頸。

## Fiber 嘅核心思想：將渲染拆成可中斷嘅工作單元

Fiber 呢個名字嚟自操作系統裡面嘅「纖程」概念——比線程更細粒度嘅工作單元。Fiber 架構將渲染過程拆分成兩個階段：

**階段一：Reconciliation（協調／可中斷）**

- 遍歷組件樹，計算需要邊啲變更（diff）
- 呢個階段可以被暫停、恢復、甚至丟棄
- 唔會修改真實 DOM

**階段二：Commit（提交／同步唔可中斷）**

- 將計算好嘅變更批量應用到真實 DOM
- 必須同步完成，確保 UI 一致性

階段一可以利用瀏覽器空閒時間分批執行：

```
幀1: [React渲染部分] → [瀏覽器繪製] → [React繼續渲染] ...
幀2: [React渲染剩餘] → [瀏覽器繪製] → [提交DOM變更]
```

咁樣 React 唔再獨佔主線程，高優先級任務（用戶輸入、動畫）可以插隊。

## Fiber 節點結構

每個 React 組件對應一個 Fiber 節點，Fiber 將原來嘅遞歸調用棧「平鋪」成咗一個鏈表：

```
虛擬 DOM 樹：         Fiber 鏈表結構：
    App                App
   /   \               ↓ child
 Foo   Bar     →     Foo → Bar
  |                   ↓ child
 Baz               Baz (sibling → Bar, return → Foo)
```

每個 Fiber 節點包含：

- `type`：組件類型
- `stateNode`：對應嘅 DOM 節點或組件實例
- `child`：第一個子 Fiber
- `sibling`：下一個兄弟 Fiber
- `return`：父 Fiber
- `pendingProps` / `memoizedProps`：新舊 props
- `effectTag`：需要執行嘅 DOM 操作（Insert、Update、Delete）

用鏈表代替遞歸調用棧，令「保存當前進度，下次繼續」成為可能。

## 優先級調度

Fiber 引入咗任務優先級嘅概念：

```javascript
// React 內部嘅優先級層級（簡化）
const priorities = {
  Synchronous: 1, // 同步，例如 setState 喺事件處理裡面
  Task: 2, // 當前 tick 內
  Animation: 3, // 下一幀前
  High: 4, // 快，但唔係立刻
  Low: 5, // 可以等
  Offscreen: 6, // 隱藏內容，最低優先級
};
```

高優先級更新（如用戶輸入觸發嘅狀態變更）可以中斷低優先級更新（如數據請求後嘅列表渲染）。

## 對開發者嘅影響：生命週期變化

Fiber 嘅分階段渲染有個副作用：階段一（協調階段）可能被執行多次（因為可以被中斷重來）。呢個意味著某啲生命週期函數可能被調用多次：

**協調階段（可能多次調用）：**

- `componentWillMount`
- `componentWillReceiveProps`
- `componentWillUpdate`
- `shouldComponentUpdate`
- `render`

**提交階段（只調用一次）：**

- `componentDidMount`
- `componentDidUpdate`
- `componentWillUnmount`

正因為咁，React 16 開始唔推薦喺協調階段嘅生命週期裡面做副作用（API 調用、手動 DOM 操作）。React 喺 16.3 會俾呢啲生命週期加上 `UNSAFE_` 前綴作為警告，最終喺 17+ 版本廢棄。

## 現在能用上 Fiber 嘅邊啲特性

React 16.0 嘅 Fiber 調度能力仲未完全開放，同步優先級之外嘅異步調度仲喺開發中。已經可以使用嘅係：

- **Error Boundaries**：`componentDidCatch`
- **`createPortal`**：將子組件渲染到任意 DOM 節點（做 Modal 好方便）
- **`render` 返回數組同字符串**：唔再強制要求單根元素

```javascript
// render 可以返回數組，唔需要多餘嘅包裹 div
render() {
  return [
    <li key="1">Item 1</li>,
    <li key="2">Item 2</li>,
    <li key="3">Item 3</li>
  ]
}

// createPortal：將 Modal 渲染到 body 上，避免 z-index 同 overflow 問題
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

Fiber 架構嘅完整潛力（Concurrent Mode、Suspense）會喺後續版本逐步釋放。

---

_下一篇：Babel 7 升級遷移實戰_
