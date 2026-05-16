---
title: "Advanced Vue Slot Usage"
date: 2018-04-11 14:48:08
tags:
  - Vue
readingTime: 2
description: "Slots are one of the most powerful component reuse mechanisms in Vue, but many developers only use the basic default slot. Here's a summary of practical usage p"
---

Slots are one of the most powerful component reuse mechanisms in Vue, but many developers only use the basic default slot. Here's a summary of practical usage patterns from real projects.

## Default Slot

```html
<!-- Child component Card.vue -->
<template>
  <div class="card">
    <div class="card-body">
      <slot></slot>
      <!-- slot placeholder -->
    </div>
  </div>
</template>

<!-- Parent usage -->
<Card>
  <h3>Title</h3>
  <p>Content</p>
</Card>
```

## Named Slots

```html
<!-- Child component Layout.vue -->
<template>
  <div class="layout">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
      <!-- no name = default slot -->
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>

<!-- Parent -->
<Layout>
  <template v-slot:header>
    <h1>Page Title</h1>
  </template>

  <p>Main content</p>

  <template v-slot:footer>
    <small>Copyright info</small>
  </template>
</Layout>
```

## Scoped Slots (Most Useful)

A regular slot can only use data from the parent component. A scoped slot lets the child pass data back to the parent so the parent controls how it renders.

```html
<!-- Child component DataTable.vue -->
<template>
  <table>
    <tr v-for="item in data" :key="item.id">
      <!-- Pass item to the parent -->
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
<!-- Parent: controls how each row renders -->
<DataTable :data="users">
  <template v-slot:default="{ row, index }">
    <td>{{ index + 1 }}</td>
    <td>{{ row.name }}</td>
    <td>
      <button @click="edit(row)">Edit</button>
    </td>
  </template>
</DataTable>
```

`DataTable` handles the looping; the parent handles how each row looks. The two are decoupled.

## Generic Table in Real Projects

```html
<!-- GenericTable.vue -->
<template>
  <div>
    <table class="table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.title }}</th>
          <th v-if="$slots.action">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in data" :key="row.id">
          <td v-for="col in columns" :key="col.key">
            <!-- Allow parent to customise individual column rendering -->
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
<!-- Usage -->
<GenericTable :columns="columns" :data="users">
  <!-- Custom status column -->
  <template v-slot:status="{ value }">
    <span :class="value === 'active' ? 'green' : 'gray'">
      {{ value === 'active' ? 'Active' : 'Disabled' }}
    </span>
  </template>

  <!-- Custom action column -->
  <template v-slot:action="{ row }">
    <button @click="edit(row)">Edit</button>
    <button @click="remove(row)">Delete</button>
  </template>
</GenericTable>
```

## Summary

- Default slot: content distribution, simplest use case
- Named slots: multiple slot positions, common in layout components
- Scoped slots: pass child data to the parent's rendering logic — perfect for tables and lists
- `$slots.xxx` lets you check whether the parent has passed a given slot
