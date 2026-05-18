---
title: "Vue slot 高階用法"
date: 2018-04-11 14:48:08
tags:
  - Vue
readingTime: 1
description: "slot 是 Vue 元件複用裡最強大的機制之一，但很多人只用到了最基礎的預設 slot。整理一下實際專案中的用法。"
---

slot 是 Vue 元件複用裡最強大的機制之一，但很多人只用到了最基礎的預設 slot。整理一下實際專案中的用法。

## 預設 slot

```html
<!-- 子元件 Card.vue -->
<template>
  <div class="card">
    <div class="card-body">
      <slot></slot>
      <!-- 插槽佔位 -->
    </div>
  </div>
</template>

<!-- 父元件使用 -->
<Card>
  <h3>標題</h3>
  <p>內容</p>
</Card>
```

## 具名 slot

```html
<!-- 子元件 Layout.vue -->
<template>
  <div class="layout">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
      <!-- 沒有 name 就是預設 slot -->
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>

<!-- 父元件 -->
<Layout>
  <template v-slot:header>
    <h1>頁面標題</h1>
  </template>

  <p>主體內容</p>

  <template v-slot:footer>
    <small>版權資訊</small>
  </template>
</Layout>
```

## 作用域 slot（最有用）

普通 slot 只能用父元件的資料。作用域 slot 可以把子元件的資料傳給父元件，讓父元件決定如何渲染。

```html
<!-- 子元件 DataTable.vue -->
<template>
  <table>
    <tr v-for="item in data" :key="item.id">
      <!-- 把 item 傳給父元件 -->
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
<!-- 父元件：控制每行如何渲染 -->
<DataTable :data="users">
  <template v-slot:default="{ row, index }">
    <td>{{ index + 1 }}</td>
    <td>{{ row.name }}</td>
    <td>
      <button @click="edit(row)">編輯</button>
    </td>
  </template>
</DataTable>
```

這樣 `DataTable` 負責資料迴圈，父元件負責每行的展示邏輯，兩者解耦。

## 實際專案中的通用表格

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
            <!-- 允許父元件自定義某列渲染 -->
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
  <!-- 自定義狀態列 -->
  <template v-slot:status="{ value }">
    <span :class="value === 'active' ? 'green' : 'gray'">
      {{ value === 'active' ? '正常' : '停用' }}
    </span>
  </template>

  <!-- 自定義操作列 -->
  <template v-slot:action="{ row }">
    <button @click="edit(row)">編輯</button>
    <button @click="remove(row)">刪除</button>
  </template>
</GenericTable>
```

## 小結

- 預設 slot：內容分發，最簡單的場景
- 具名 slot：多個插槽位，佈局類元件常用
- 作用域 slot：子元件傳資料給父元件的渲染邏輯，表格、列表類元件神器
- `$slots.xxx` 可以判斷父元件是否傳入了某個 slot