---
title: "React Compiler 预览与原理"
date: 2023-01-19 11:47:06
tags:
  - React
readingTime: 3
description: "React Compiler（原 React Forget）是 React 团队正在开发的编译时优化工具。它的目标是自动处理 `useMemo`、`useCallback`、`React.memo` 的插入，让开发者不再需要手动管理这些性能优化。本文基于公开信息分析其工作原理和对现有代码的影响。"
---

React Compiler（原 React Forget）是 React 团队正在开发的编译时优化工具。它的目标是自动处理 `useMemo`、`useCallback`、`React.memo` 的插入，让开发者不再需要手动管理这些性能优化。本文基于公开信息分析其工作原理和对现有代码的影响。

## 现状：手动优化的痛点

在 React 18 中，性能优化完全依赖开发者手动处理。代码充斥着大量样板：

```tsx
// 没有优化时，每次父组件渲染都会重新创建函数和对象
function Parent() {
  const [count, setCount] = useState(0)

  // 每次渲染都是新的引用
  const handleClick = () => console.log('clicked')
  const config = { step: 1 }

  return <Child onClick={handleClick} config={config} />
}

// 手动优化后
function Parent() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => console.log('clicked'), [])
  const config = useMemo(() => ({ step: 1 }), [])

  return <Child onClick={handleClick} config={config} />
}

const Child = memo(function Child({ onClick, config }: Props) {
  // 只有当 onClick 或 config 的引用变化时才重新渲染
  return <div onClick={onClick}>Step: {config.step}</div>
})
```

这种优化模式有两个问题：一是容易遗漏（该 memo 的没 memo），二是容易过度 memo（不需要 memo 的也 memo 了），两种情况都会降低性能。

## Compiler 的工作原理

React Compiler 是一个 Babel 插件，在编译阶段分析组件代码的依赖关系，自动插入等效的 memoization 逻辑。

```tsx
// 开发者写的代码
function TodoList({ items, filter }: { items: Todo[], filter: string }) {
  const filtered = items.filter(item => item.text.includes(filter))
  const count = filtered.length

  return (
    <div>
      <p>共 {count} 条</p>
      {filtered.map(item => (
        <TodoItem key={item.id} item={item} />
      ))}
    </div>
  )
}

// Compiler 自动转换后的等效逻辑（概念性伪代码）
function TodoList({ items, filter }: Props) {
  // 自动为派生数据添加 memo
  const filtered = useMemo(
    () => items.filter(item => item.text.includes(filter)),
    [items, filter]
  )
  const count = useMemo(() => filtered.length, [filtered])

  // 自动为组件引用添加稳定化
  return React.createElement('div', null,
    React.createElement('p', null, '共 ', count, ' 条'),
    filtered.map(item =>
      React.createElement(TodoItem, { key: item.id, item })
    )
  )
}
```

Compiler 不会改变组件的行为，只优化不必要的重新计算和重新渲染。从 React Conf 2023 的 demo 来看，它能识别出 props 是否稳定、派生值是否需要缓存、事件处理器是否需要稳定引用。

## 对现有代码的影响

React Compiler 的目标是兼容现有代码。如果代码已经手动做了 `useMemo`/`useCallback`，Compiler 会识别并跳过，不会重复插入。

```tsx
// 已有手动 memo 的代码，Compiler 不会重复处理
function Example() {
  const value = useMemo(() => expensiveCalc(), [dep])
  const handler = useCallback(() => doSomething(), [])
  // Compiler 看到已经 memo 了，跳过
  return <Child value={value} onAction={handler} />
}

// 但有些模式 Compiler 无法优化
function BadExample() {
  // 可变的 ref 操作，Compiler 无法安全推断
  const ref = useRef(null)
  useEffect(() => {
    ref.current = document.getElementById('target')
  }, [])

  // 隐式的副作用，Compiler 可能无法识别
  const data = globalStore.getData() // 外部可变状态
  return <div>{data}</div>
}
```

Compiler 要求代码遵循 React 的规则：不修改 props、不在渲染时执行副作用、依赖不可变数据。这正是 `eslint-plugin-react-hooks` 的 `exhaustive-deps` 和 `hooks/rules` 一直在强调的。

## 编译时优化 vs 运行时优化

React Compiler 代表了 React 从纯运行时框架向编译时辅助框架的转变。

```tsx
// 运行时优化（当前方案）
// 依赖开发者手动插入，运行时执行比较
const Child = memo(function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
})

// 编译时优化（Compiler 方案）
// 编译器自动分析：items 是 props，如果没有变化就不需要重新执行
function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
}
// 编译后自动包裹了 memo 逻辑，无需开发者干预
```

这与 Svelte、SolidJS 等框架的思路一致：在编译阶段做尽可能多的分析，减少运行时的工作量。但 React 不会像 Svelte 那样完全编译掉虚拟 DOM，因为 RSC 和 Server Components 需要运行时的序列化能力。

## 小结

- React Compiler 自动插入 `useMemo`/`useCallback`/`memo`，目标是让开发者不再手动做这些优化
- 编译器要求代码遵循 React 规则（不可变性、无副作用渲染），eslint 规则的严格执行是 Compiler 兼容的前提
- 已有手动优化的代码不会被 Compiler 干扰，它会跳过已经 memo 的部分
- Compiler 代表 React 向编译时优化的转变，但不会完全抛弃虚拟 DOM 运行时
- 目前 Compiler 仍在开发中，建议在新项目中养成遵循 React 规则的习惯