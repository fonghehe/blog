---
title: "Vue slot 高级用法"
date: 2018-04-11 14:48:08
tags:
  - Vue
---

slot 是 Vue 组件复用里最强大的机制之一，但很多人只用到了最基础的默认 slot。整理一下实际项目中的用法。

## 默认 slot

```html
<!-- 子组件 Card.vue -->
<template>
  <div class="card">
    <div class="card-body">
      <slot></slot>
      <!-- 插槽占位 -->
    </div>
  </div>
</template>

<!-- 父组件使用 -->
<Card>
  <h3>标题</h3>
  <p>内容</p>
</Card>
```

## 具名 slot

```html
<!-- 子组件 Layout.vue -->
<template>
  <div class="layout">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
      <!-- 没有 name 就是默认 slot -->
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>

<!-- 父组件 -->
<Layout>
  <template v-slot:header>
    <h1>页面标题</h1>
  </template>

  <p>主体内容</p>

  <template v-slot:footer>
    <small>版权信息</small>
  </template>
</Layout>
```

## 作用域 slot（最有用）

普通 slot 只能用父组件的数据。作用域 slot 可以把子组件的数据传给父组件，让父组件决定如何渲染。

```html
<!-- 子组件 DataTable.vue -->
<template>
  <table>
    <tr v-for="item in data" :key="item.id">
      <!-- 把 item 传给父组件 -->
      <slot :row="item" :index="index"></slot>
    </tr>
  </table>
</template>

<script>
  export default {
    props: ["data"],
  };
</script>
```

```html
<!-- 父组件：控制每行如何渲染 -->
<DataTable :data="users">
  <template v-slot:default="{ row, index }">
    <td>{{ index + 1 }}</td>
    <td>{{ row.name }}</td>
    <td>
      <button @click="edit(row)">编辑</button>
    </td>
  </template>
</DataTable>
```

这样 `DataTable` 负责数据循环，父组件负责每行的展示逻辑，两者解耦。

## 实际项目中的通用表格

```html
<!-- GenericTable.vue -->
<template>
  <div>
    <table class="table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.title }}</th>
          <th v-if="$slots.action">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in data" :key="row.id">
          <td v-for="col in columns" :key="col.key">
            <!-- 允许父组件自定义某列渲染 -->
            <slot :name="col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
          <td v-if="$slots.action">
            <slot name="action" :row="row"></slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

```html
<!-- 使用 -->
<GenericTable :columns="columns" :data="users">
  <!-- 自定义状态列 -->
  <template v-slot:status="{ value }">
    <span :class="value === 'active' ? 'green' : 'gray'">
      {{ value === 'active' ? '正常' : '禁用' }}
    </span>
  </template>

  <!-- 自定义操作列 -->
  <template v-slot:action="{ row }">
    <button @click="edit(row)">编辑</button>
    <button @click="remove(row)">删除</button>
  </template>
</GenericTable>
```

## 小结

- 默认 slot：内容分发，最简单的场景
- 具名 slot：多个插槽位，布局类组件常用
- 作用域 slot：子组件传数据给父组件的渲染逻辑，表格、列表类组件神器
- `$slots.xxx` 可以判断父组件是否传入了某个 slot