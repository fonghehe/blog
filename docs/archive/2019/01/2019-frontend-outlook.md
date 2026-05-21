---
title: "2019 前端技术趋势展望：从工程化到框架演进"
date: 2019-01-06 16:46:29
tags:
  - 前端
readingTime: 2
description: "2018 年过得充实。React Hooks 在 React Conf 了亮相，Vue 3 RFC 开始公开审阅，TypeScript 在大型项目中的渗透率持续上升。展望 2019，我认为有几个方向尤其就展望。"
wordCount: 511
---

2018 年过得充实。React Hooks 在 React Conf 了亮相，Vue 3 RFC 开始公开审阅，TypeScript 在大型项目中的渗透率持续上升。展望 2019，我认为有几个方向尤其就展望。

## React Hooks 将改变写法

React 16.8 打算 2019 Q1 正式发布 Hooks。这不是小改变，而是会影响整个 React 生态的范式转射。

```jsx
// 之前：类组件
class Counter extends Component {
  state = { count: 0 };
  increment = () => this.setState({ count: this.state.count + 1 });
  render() {
    return <button onClick={this.increment}>{this.state.count}</button>;
  }
}

// 2019 ：函数组件 + Hooks
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

预测：年底前大多数新写的 React 组件将使用函数 + Hooks。

## Vue 3 Composition API 正式落地

Vue 3 的 Composition API RFC 已在 2018 年末公开，2019 年预计进入 alpha 阶段。核心思路是用函数投射替代选项对象，解决逐渐大型项目中的逻辑复用困题。

## TypeScript 全面普及

2018 年的 State of JS 调查显示，TypeScript 满意度达到历史最高。Vue CLI 3 已将 TypeScript 作为一级选项，Create React App 也内置了 TypeScript 模板。升级已不是“要不要用”，而是“何时迁进”的问题。

## WebAssembly 进入实用期

Figma 用 WebAssembly 路线实现了浏覈器端的高性能渲染。尽管大多数前端工程师不会编写 Wasm，但了解它的使用场景（视频编制、CAD 渲染、加密库）越来越重要。

## 工程化：目标是消灭配置

Create React App、Vue CLI 3、Angular CLI 共同指向同一个目标：让开发者不再需要手动配置 webpack。优质的框架封装 = 更快的项目启动速度 + 更一致的团队配置。

## 2019 年心路图

| 方向       | 建议行动                                       |
| 
---------- | ---------------------------------------------- |
| React      | 学习 Hooks，逐步迁移现有组件                   |
| Vue        | 关注 Vue 3 RFC，提前熟悉 Composition API 思想  |
| TypeScript | 在新项目中强制开启。学习 Generic、Mapped Types |
| 工程化     | 掌握 webpack 性能分析工具                      |
| 性能       | 了解 Core Web Vitals 指标                      |

## 总结

2019 年的主调是“更好的开发体验”：Hooks 让 React 组件更简洁，Composition API 让 Vue 逻辑更清晰，TypeScript 让重构更安全。展望是展望，仳第一个要把 2018 的知识消化成实力。
