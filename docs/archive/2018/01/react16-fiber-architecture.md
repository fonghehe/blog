---
title: "React 16 Fiber 架构解析：为什么重写了渲染引擎"
date: 2018-01-25 11:10:29
tags:
  - React
readingTime: 3
description: "React 16 在 2017 年 9 月发布，底层做了彻底重写，核心就是 Fiber 架构。这次重写不是为了性能数字好看，而是为了解决 React 15 在复杂应用里的根本性架构问题。"
---

React 16 在 2017 年 9 月发布，底层做了彻底重写，核心就是 Fiber 架构。这次重写不是为了性能数字好看，而是为了解决 React 15 在复杂应用里的根本性架构问题。

## React 15 的问题：同步不可中断的渲染

React 15 的渲染过程是同步的、递归的：一旦开始渲染（调用 `setState`），就必须一口气走完整个组件树的 diff 和更新，期间无法暂停。

浏览器的主线程同时负责 JS 执行、页面渲染、响应用户输入。如果 React 的渲染占用主线程超过 16ms（60fps 的单帧预算），下一帧的渲染就会推迟，用户会感知到卡顿。

对于组件树规模不大的应用，16ms 通常够用。但当树很深或更新频繁时，这个同步阻塞就成了瓶颈。

## Fiber 的核心思想：把渲染拆成可中断的工作单元

Fiber 这个名字来自操作系统里的"纤程"概念——比线程更细粒度的工作单元。Fiber 架构把渲染过程拆分成两个阶段：

**阶段一：Reconciliation（协调/可中断）**

- 遍历组件树，计算需要哪些变更（diff）
- 这个阶段可以被暂停、恢复、甚至丢弃
- 不会修改真实 DOM

**阶段二：Commit（提交/同步不可中断）**

- 把计算好的变更批量应用到真实 DOM
- 必须同步完成，确保 UI 一致性

阶段一可以利用浏览器空闲时间分批执行：

```
帧1: [React渲染部分] → [浏览器绘制] → [React继续渲染] ...
帧2: [React渲染剩余] → [浏览器绘制] → [提交DOM变更]
```

这样 React 不再独占主线程，高优先级任务（用户输入、动画）可以插队。

## Fiber 节点结构

每个 React 组件对应一个 Fiber 节点，Fiber 把原来的递归调用栈"平铺"成了一个链表：

```
虚拟 DOM 树：         Fiber 链表结构：
    App                App
   /   \               ↓ child
 Foo   Bar     →     Foo → Bar
  |                   ↓ child
 Baz               Baz (sibling → Bar, return → Foo)
```

每个 Fiber 节点包含：

- `type`：组件类型
- `stateNode`：对应的 DOM 节点或组件实例
- `child`：第一个子 Fiber
- `sibling`：下一个兄弟 Fiber
- `return`：父 Fiber
- `pendingProps` / `memoizedProps`：新旧 props
- `effectTag`：需要执行的 DOM 操作（Insert、Update、Delete）

用链表代替递归调用栈，使得"保存当前进度，下次继续"成为可能。

## 优先级调度

Fiber 引入了任务优先级的概念：

```javascript
// React 内部的优先级层级（简化）
const priorities = {
  Synchronous: 1, // 同步，比如 setState 在事件处理里
  Task: 2, // 当前 tick 内
  Animation: 3, // 下一帧前
  High: 4, // 快，但不是立刻
  Low: 5, // 可以等
  Offscreen: 6, // 隐藏内容，最低优先级
};
```

高优先级更新（如用户输入触发的状态变更）可以中断低优先级更新（如数据请求后的列表渲染）。

## 对开发者的影响：生命周期变化

Fiber 的分阶段渲染有个副作用：阶段一（协调阶段）可能被执行多次（因为可以被中断重来）。这意味着某些生命周期函数可能被调用多次：

**协调阶段（可能多次调用）：**

- `componentWillMount`
- `componentWillReceiveProps`
- `componentWillUpdate`
- `shouldComponentUpdate`
- `render`

**提交阶段（只调用一次）：**

- `componentDidMount`
- `componentDidUpdate`
- `componentWillUnmount`

正因为如此，React 16 开始不推荐在协调阶段的生命周期里做副作用（API 调用、手动 DOM 操作）。React 在 16.3 会给这些生命周期加上 `UNSAFE_` 前缀作为警告，最终在 17+ 版本废弃。

## 现在能用上 Fiber 的哪些特性

React 16.0 的 Fiber 调度能力还没有完全开放，同步优先级之外的异步调度还在开发中。已经可以使用的是：

- **Error Boundaries**：`componentDidCatch`
- **`createPortal`**：把子组件渲染到任意 DOM 节点（做 Modal 很方便）
- **`render` 返回数组和字符串**：不再强制要求单根元素

```javascript
// render 可以返回数组，不需要多余的包裹 div
render() {
  return [
    <li key="1">Item 1</li>,
    <li key="2">Item 2</li>,
    <li key="3">Item 3</li>
  ]
}

// createPortal：把 Modal 渲染到 body 上，避免 z-index 和 overflow 问题
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

Fiber 架构的完整潜力（Concurrent Mode、Suspense）会在后续版本逐步释放。

---

_下一篇：Babel 7 升级迁移实战_
