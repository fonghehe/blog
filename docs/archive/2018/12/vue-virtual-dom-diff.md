---
title: "Vue 虚拟 DOM 和 diff 算法"
date: 2018-12-01 10:43:17
tags:
  - Vue
readingTime: 1
description: "面试常被问到\"Vue 的 diff 算法是怎么工作的\"，网上的文章大多说得很抽象。这里用实际例子说清楚。"
---

面试常被问到"Vue 的 diff 算法是怎么工作的"，网上的文章大多说得很抽象。这里用实际例子说清楚。

## 为什么要有虚拟 DOM

操作真实 DOM 很慢，因为每次操作都可能触发浏览器的重排（layout）和重绘（paint）。

```javascript
// 如果需要更新一个列表，最暴力的方式：
container.innerHTML = items.map((item) => `<li>${item.name}</li>`).join("");
// 问题：销毁了所有 DOM 节点，再创建新的，损失了 DOM 状态（如焦点、滚动位置）

// 理想方式：只更新变化的部分
// 虚拟 DOM 就是用 JS 对象模拟 DOM，通过对比新旧虚拟 DOM 找出最小差异
```

## 虚拟 DOM 的结构

```javascript
// 真实 DOM
// <div class="container">
//   <ul>
//     <li>Item 1</li>
//   </ul>
// </div>

// 对应的虚拟 DOM（简化）
const vnode = {
  tag: "div",
  data: { class: "container" },
  children: [
    {
      tag: "ul",
      children: [{ tag: "li", children: [{ text: "Item 1" }] }],
    },
  ],
};
```

## diff 算法的核心思路

Vue 的 diff 算法做了几个关键假设（来自 React 的 diff）：

```
1. 只比较同层节点（不跨层比较）
   → 如果节点从 div A 移到 div B，视为删除后新增
   → 现实中 DOM 跨层移动非常少见，这个假设通常正确

2. 不同类型的节点，直接替换（不深入比较）
   → <div> 变成 <p>，直接替换整棵子树

3. 相同类型的节点，通过 key 判断是否是同一个节点
   → 没有 key：按位置比较
   → 有 key：匹配相同 key 的节点，实现重排
```

## 列表 diff：双端比较

Vue 2 的列表 diff 用**双端比较**：同时从新旧列表的两端开始比较：

```
旧: [A, B, C, D]
新: [D, A, B, C]

步骤：
1. 新头(D) vs 旧头(A) → 不同
2. 新尾(C) vs 旧尾(D) → 不同
3. 新头(D) vs 旧尾(D) → 相同！把 D 移到前面
   旧: [A, B, C]（D 已处理）
   新: [A, B, C]
4. 剩余：A=A, B=B, C=C → 都相同，不需要移动

结果：只需要移动 D，不需要重建整个列表
```

## key 的重要性

```html
{% raw %}
<!-- ❌ 没有 key：按位置 diff，可能造成不必要的更新 -->
<li v-for="item in list">{{ item.name }}</li>

<!-- 假设 list 从 [A, B, C] 变成 [B, C]（删除了 A）
Vue 会更新 li[0] 的内容（A→B），更新 li[1] 的内容（B→C），删除 li[2]
做了 2 次更新 + 1 次删除 -->

<!-- ✅ 有 key：精确匹配，只删除对应节点 -->
<li v-for="item in list" :key="item.id">{{ item.name }}</li>
<!-- Vue 发现 B 和 C 没变，只删除 A
做了 1 次删除 -->
{% endraw %}
```

**key 的另一个作用**：强制重新创建组件（用于清除状态）：

```html
<!-- 切换用户时，强制重新创建 UserProfile 组件，清除旧用户的状态 -->
<UserProfile :key="userId" :userId="userId" />
```

## 小结

- 虚拟 DOM 是 JS 对象模拟的 DOM，通过 diff 找最小变化，减少真实 DOM 操作
- diff 的三个假设：同层比较、不同类型直接替换、用 key 匹配
- Vue 2 的列表 diff 用双端比较，效率较高
- 列表渲染务必加 `:key`，用稳定的唯一 id，不要用 index（除非列表不会变化）
