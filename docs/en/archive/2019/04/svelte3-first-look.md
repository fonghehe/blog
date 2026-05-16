---
title: "First Look at Svelte 3: A Framework Without Virtual DOM"
date: 2019-04-07 10:35:05
tags:
  - Svelte
readingTime: 1
description: "Svelte 3 was released last week, and its approach is completely different from Vue/React — it's a compile-time framework with no runtime and no Virtual DOM. Aft"
---

Svelte 3 was released last week, and its approach is completely different from Vue/React — it's a compile-time framework with no runtime and no Virtual DOM. After using it for a week, here are my thoughts.

## The Biggest Difference from Vue/React

**Vue/React**: runtime frameworks that need to load framework code (~30 KB+) and perform reactivity in the browser.

**Svelte**: a compile-time framework that compiles `.svelte` files into efficient vanilla JS. The final bundle has almost no framework overhead.

## Svelte Syntax

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0
  let name = 'World'

  // Reactive declaration (computed)
  $: doubled = count * 2
  $: console.log('count changed:', count)  // reactive side effect

  function increment() {
    count += 1
  }
</script>

<!-- Template -->
<h1>Hello {name}!</h1>
<p>Count: {count}, Doubled: {doubled}</p>
<button on:click={increment}>+1</button>

<!-- Conditionals and loops -->
{#if count > 10}
  <p>Greater than 10!</p>
{:else if count > 5}
  <p>Over half way there</p>
{:else}
  <p>Keep going</p>
{/if}

{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}

<style>
  /* Styles are automatically scoped! */
  button { background: blue; color: white; }
</style>
```

## Reactivity Without `this`

```svelte
<script>
  let user = { name: 'Alice', age: 25 }

  // Object assignment triggers updates (note: push does NOT trigger updates)
  function birthday() {
    user = { ...user, age: user.age + 1 }  // or user.age += 1
  }

  let todos = []
  function addTodo(text) {
    todos = [...todos, { id: Date.now(), text, done: false }]
    // todos.push(xxx) does NOT trigger updates!
  }
</script>
```

## Store (Global State)

```javascript
// stores.js
import { writable, derived, readable } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);
```

Svelte is a compelling option for projects where bundle size matters — give it a try if you haven't already.
