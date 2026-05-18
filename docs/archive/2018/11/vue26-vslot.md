---
title: "Vue 2.6 发布：v-slot 新语法与其他改进"
date: 2018-11-08 10:06:29
tags:
  - Vue
readingTime: 2
description: "Vue 2.6 正式发布了，主要改进是插槽语法统一、错误处理改进，以及对 Vue 3 的一些前瞻性改动。"
---

Vue 2.6 正式发布了，主要改进是插槽语法统一、错误处理改进，以及对 Vue 3 的一些前瞻性改动。

## 最大变化：v-slot 统一插槽语法

之前 Vue 2 有三种插槽写法：默认插槽、具名插槽、作用域插槽，语法各不相同：

```html
{% raw %}
<!-- 之前（Vue 2.5）：三套语法 -->

<!-- 具名插槽 -->
<template slot="header">
  <h1>标题</h1>
</template>

<!-- 作用域插槽（旧语法）-->
<template slot="item" slot-scope="{ item }">
  <div>{{ item.name }}</div>
</template>

<!-- 新的作用域插槽语法（2.5 引入）-->
<template v-slot:item="{ item }">
  <div>{{ item.name }}</div>
</template>
{% endraw %}
```

Vue 2.6 用 `v-slot` 统一了所有插槽：

```html
{% raw %}
<!-- Vue 2.6：统一用 v-slot -->

<!-- 默认插槽 -->
<MyComponent>
  <template v-slot:default>
    <p>默认内容</p>
  </template>
</MyComponent>

<!-- 具名插槽 -->
<MyLayout>
  <template v-slot:header>
    <h1>标题</h1>
  </template>

  <template v-slot:default>
    <p>主内容</p>
  </template>

  <template v-slot:footer>
    <p>页脚</p>
  </template>
</MyLayout>

<!-- 作用域插槽 -->
<MyTable :items="items">
  <template v-slot:item="{ row, index }">
    <tr :key="row.id">
      <td>{{ index + 1 }}</td>
      <td>{{ row.name }}</td>
    </tr>
  </template>
</MyTable>
{% endraw %}
```

**缩写语法 `#`：**

```html
<!-- v-slot:header 可以缩写为 #header -->
<MyLayout>
  <template #header>
    <h1>标题</h1>
  </template>

  <template #default="{ item }">
    <ItemCard :item="item" />
  </template>
</MyLayout>
```

## 组件定义：从 `v-slot` 看设计意图

提供插槽的组件（Slot Provider）写法没变，只是消费方语法统一了：

```html
<!-- MyTable 组件 -->
<template>
  <table>
    <tbody>
      <slot
        v-for="(row, index) in items"
        name="item"
        :row="row"
        :index="index"
      />
    </tbody>
  </table>
</template>
```

## 其他改进

### 动态指令参数

```html
<!-- 现在可以动态指定事件名、插槽名 -->
<button @[eventName]="handler">按钮</button>
<template #[slotName]>内容</template>
```

### 错误处理改进

`errorCaptured` 钩子现在可以捕获异步组件的错误：

```javascript
export default {
  errorCaptured(error, component, info) {
    console.log("捕获到错误:", error);
    console.log("发生在:", info);
    return false; // 阻止错误继续向上传播
  },
};
```

### 编译提示改进

开发环境的错误提示更详细了，能准确指出是哪个组件、哪一行出了问题。

## 旧语法的废弃计划

`slot` 和 `slot-scope` 旧语法还可以用（Vue 2.x 内不会删除），但已被标记为废弃，Vue 3 会移除它们。

建议逐步迁移到 `v-slot`：

```html
<!-- 废弃（deprecated） -->
<template slot="header">...</template>
<template slot="item" slot-scope="{ item }">...</template>

<!-- 推荐 -->
<template #header>...</template>
<template #item="{ item }">...</template>
```

## Vue 3 预告

Vue 2.6 发布的同时，尤雨溪也在博客里提到了 Vue 3 的计划：

- 性能提升（优化 VDOM、更好的 Tree Shaking）
- Composition API（类似 React Hooks 的逻辑复用方式）
- 更好的 TypeScript 支持
- 更小的体积

预计 2019 年会有更多消息。

## 小结

- `v-slot` 统一了 Vue 的所有插槽语法，`#` 是缩写
- 动态指令参数 `@[eventName]` 提供了更大的灵活性
- 旧的 `slot` / `slot-scope` 标记废弃，Vue 3 会移除
- Vue 3 的 Composition API 和 TypeScript 支持值得期待
