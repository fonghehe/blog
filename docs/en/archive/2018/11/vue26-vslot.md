---
title: "Vue 2.6 Released: v-slot New Syntax and Other Improvements"
date: 2018-11-08 10:06:29
tags:
  - Vue
readingTime: 2
description: "Vue 2.6 has been officially released. The main improvements are a unified slot syntax, better error handling, and some forward-looking changes that preview Vue "
---

Vue 2.6 has been officially released. The main improvements are a unified slot syntax, better error handling, and some forward-looking changes that preview Vue 3.

## The Biggest Change: v-slot Unifies Slot Syntax

Previously Vue 2 had three different slot syntaxes — default slots, named slots, and scoped slots all looked different:

```html
{% raw %}
<!-- Before (Vue 2.5): three different syntaxes -->

<!-- Named slot -->
<template slot="header">
  <h1>Title</h1>
</template>

<!-- Scoped slot (old syntax) -->
<template slot="item" slot-scope="{ item }">
  <div>{{ item.name }}</div>
</template>

<!-- Newer scoped slot syntax (introduced in 2.5) -->
<template v-slot:item="{ item }">
  <div>{{ item.name }}</div>
</template>
{% endraw %}
```

Vue 2.6 uses `v-slot` to unify all slot types:

```html
{% raw %}
<!-- Vue 2.6: unified v-slot -->

<!-- Default slot -->
<MyComponent>
  <template v-slot:default>
    <p>Default content</p>
  </template>
</MyComponent>

<!-- Named slot -->
<MyLayout>
  <template v-slot:header>
    <h1>Title</h1>
  </template>

  <template v-slot:default>
    <p>Main content</p>
  </template>

  <template v-slot:footer>
    <p>Footer</p>
  </template>
</MyLayout>

<!-- Scoped slot -->
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

**Shorthand with `#`:**

```html
<!-- v-slot:header can be shortened to #header -->
<MyLayout>
  <template #header>
    <h1>Title</h1>
  </template>

  <template #default="{ item }">
    <ItemCard :item="item" />
  </template>
</MyLayout>
```

## Components Providing Slots (Slot Provider)

The syntax on the providing side hasn't changed — only the consuming side is unified:

```html
<!-- MyTable component -->
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

## Other Improvements

### Dynamic Directive Arguments

```html
<!-- You can now dynamically specify event names and slot names -->
<button @[eventName]="handler">Button</button>
<template #[slotName]>Content</template>
```

### Error Handling Improvements

The `errorCaptured` hook can now catch errors from async components:

```javascript
export default {
  errorCaptured(error, component, info) {
    console.log("Caught error:", error);
    console.log("Where:", info);
    return false; // prevent the error from propagating further
  },
};
```

### Improved Compile Warnings

Development-mode error messages are now more detailed, accurately pointing to which component and which line has the issue.

## Deprecation Plan for Old Syntax

The old `slot` and `slot-scope` syntax still works (it won't be removed in Vue 2.x), but it has been marked as deprecated and will be removed in Vue 3.

Gradually migrate to `v-slot`:

```html
<!-- Deprecated -->
<template slot="header">...</template>
<template slot="item" slot-scope="{ item }">...</template>

<!-- Recommended -->
<template #header>...</template>
<template #item="{ item }">...</template>
```

## Vue 3 Preview

Alongside Vue 2.6, Evan You also mentioned Vue 3 plans on his blog:

- Performance improvements (optimized VDOM, better Tree Shaking)
- Composition API (a Hook-like approach to logic reuse)
- Better TypeScript support
- Smaller bundle size

More news is expected in 2019.

## Summary

- `v-slot` unifies all Vue slot syntax; `#` is the shorthand
- Dynamic directive arguments `@[eventName]` provide greater flexibility
- Old `slot` / `slot-scope` is deprecated; Vue 3 will remove it
- Vue 3's Composition API and TypeScript improvements are worth looking forward to
