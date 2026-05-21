---
title: "2019 前端技術趨勢展望：從工程化到框架演進"
date: 2019-01-06 16:46:29
tags:
  - 前端
readingTime: 2
description: "2018 年過得充實。React Hooks 在 React Conf 了亮相，Vue 3 RFC 開始公開審閲，TypeScript 在大型項目中的滲透率持續上升。展望 2019，我認為有幾個方向尤其就展望。"
wordCount: 511
---

2018 年過得充實。React Hooks 在 React Conf 了亮相，Vue 3 RFC 開始公開審閲，TypeScript 在大型項目中的滲透率持續上升。展望 2019，我認為有幾個方向尤其就展望。

## React Hooks 將改變寫法

React 16.8 打算 2019 Q1 正式發佈 Hooks。這不是小改變，而是會影響整個 React 生態的範式轉射。

```jsx
// 之前：類組件
class Counter extends Component {
  state = { count: 0 };
  increment = () => this.setState({ count: this.state.count + 1 });
  render() {
    return <button onClick={this.increment}>{this.state.count}</button>;
  }
}

// 2019 ：函數組件 + Hooks
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

預測：年底前大多數新寫的 React 組件將使用函數 + Hooks。

## Vue 3 Composition API 正式落地

Vue 3 的 Composition API RFC 已在 2018 年末公開，2019 年預計進入 alpha 階段。核心思路是用函數投射替代選項對象，解決逐漸大型項目中的邏輯複用困題。

## TypeScript 全面普及

2018 年的 State of JS 調查顯示，TypeScript 滿意度達到歷史最高。Vue CLI 3 已將 TypeScript 作為一級選項，Create React App 也內置了 TypeScript 模板。升級已不是“要不要用”，而是“何時遷進”的問題。

## WebAssembly 進入實用期

Figma 用 WebAssembly 路線實現了瀏核器端的高性能渲染。儘管大多數前端工程師不會編寫 Wasm，但瞭解它的使用場景（視頻編制、CAD 渲染、加密庫）越來越重要。

## 工程化：目標是消滅配置

Create React App、Vue CLI 3、Angular CLI 共同指向同一個目標：讓開發者不再需要手動配置 webpack。優質的框架封裝 = 更快的項目啓動速度 + 更一致的團隊配置。

## 2019 年心路圖

| 方向       | 建議行動                                       |
| 
---------- | ---------------------------------------------- |
| React      | 學習 Hooks，逐步遷移現有組件                   |
| Vue        | 關注 Vue 3 RFC，提前熟悉 Composition API 思想  |
| TypeScript | 在新項目中強制開啓。學習 Generic、Mapped Types |
| 工程化     | 掌握 webpack 性能分析工具                      |
| 性能       | 瞭解 Core Web Vitals 指標                      |

## 總結

2019 年的主調是“更好的開發體驗”：Hooks 讓 React 組件更簡潔，Composition API 讓 Vue 邏輯更清晰，TypeScript 讓重構更安全。展望是展望，仳第一個要把 2018 的知識消化成實力。
