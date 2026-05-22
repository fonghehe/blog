---
title: "Vue 2.6 發佈：v-slot 新語法與其他改進"
date: 2018-11-08 10:06:29
tags:
  - Vue
readingTime: 2
description: "Vue 2.6 正式發佈了，主要改進是插槽語法統一、錯誤處理改進，以及對 Vue 3 的一些前瞻性改動。"
wordCount: 391
---

Vue 2.6 正式發佈了，主要改進是插槽語法統一、錯誤處理改進，以及對 Vue 3 的一些前瞻性改動。

## 最大變化：v-slot 統一插槽語法

之前 Vue 2 有三種插槽寫法：默認插槽、具名插槽、作用域插槽，語法各不相同：

```html
{% raw %}
<!-- 之前（Vue 2.5）：三套語法 -->

<!-- 具名插槽 -->
<template slot="header">
  <h1>標題</h1>
</template>

<!-- 作用域插槽（舊語法）-->
<template slot="item" slot-scope="{ item }">
  <div>{{ item.name }}</div>
</template>

<!-- 新的作用域插槽語法（2.5 引入）-->
<template v-slot:item="{ item }">
  <div>{{ item.name }}</div>
</template>
{% endraw %}
```

Vue 2.6 用 `v-slot` 統一了所有插槽：

```html
{% raw %}
<!-- Vue 2.6：統一用 v-slot -->

<!-- 默認插槽 -->
<MyComponent>
  <template v-slot:default>
    <p>默認內容</p>
  </template>
</MyComponent>

<!-- 具名插槽 -->
<MyLayout>
  <template v-slot:header>
    <h1>標題</h1>
  </template>

  <template v-slot:default>
    <p>主內容</p>
  </template>

  <template v-slot:footer>
    <p>頁腳</p>
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

**縮寫語法 `#`：**

```html
<!-- v-slot:header 可以縮寫為 #header -->
<MyLayout>
  <template #header>
    <h1>標題</h1>
  </template>

  <template #default="{ item }">
    <ItemCard :item="item" />
  </template>
</MyLayout>
```

## 組件定義：從 `v-slot` 看設計意圖

提供插槽的組件（Slot Provider）寫法沒變，隻是消費方語法統一了：

```html
<!-- MyTable 組件 -->
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

## 其他改進

### 動態指令參數

```html
<!-- 現在可以動態指定事件名、插槽名 -->
<button @[eventName]="handler">按鈕</button>
<template #[slotName]>內容</template>
```

### 錯誤處理改進

`errorCaptured` 鈎子現在可以捕獲異步組件的錯誤：

```javascript
export default {
  errorCaptured(error, component, info) {
    console.log("捕獲到錯誤:", error);
    console.log("發生在:", info);
    return false; // 阻止錯誤繼續向上傳播
  },
};
```

### 編譯提示改進

開發環境的錯誤提示更詳細了，能準確指出是哪個組件、哪一行出了問題。

## 舊語法的廢棄計劃

`slot` 和 `slot-scope` 舊語法還可以用（Vue 2.x 內不會刪除），但已被標記為廢棄，Vue 3 會移除它們。

建議逐步遷移到 `v-slot`：

```html
<!-- 廢棄（deprecated） -->
<template slot="header">...</template>
<template slot="item" slot-scope="{ item }">...</template>

<!-- 推薦 -->
<template #header>...</template>
<template #item="{ item }">...</template>
```

## Vue 3 預告

Vue 2.6 發佈的同時，尤雨溪也在博客裏提到了 Vue 3 的計劃：

- 性能提升（優化 VDOM、更好的 Tree Shaking）
- Composition API（類似 React Hooks 的邏輯複用方式）
- 更好的 TypeScript 支持
- 更小的體積

預計 2019 年會有更多消息。

## 小結

- `v-slot` 統一了 Vue 的所有插槽語法，`#` 是縮寫
- 動態指令參數 `@[eventName]` 提供了更大的靈活性
- 舊的 `slot` / `slot-scope` 標記廢棄，Vue 3 會移除
- Vue 3 的 Composition API 和 TypeScript 支持值得期待
