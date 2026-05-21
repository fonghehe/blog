---
title: "Introduction to Vue Unit Testing: Jest + Vue Test Utils"
date: 2018-11-03 14:43:25
tags:
  - Vue
readingTime: 2
description: "I always thought writing tests was something I'd do \"when I have time,\" but as the number of components grew, every code change felt nerve-wracking. I finally t"
wordCount: 104
---

I always thought writing tests was something I'd do "when I have time," but as the number of components grew, every code change felt nerve-wracking. I finally took the time to set up a test environment, and now I wish I had done it sooner.

## Installation

```bash
# Create a Vue CLI 3 project with Unit Testing, or add it manually
vue add unit-jest

# Manual installation
npm install -D @vue/test-utils jest vue-jest babel-jest
```

## Basic Test: A Counter Component

```javascript
{% raw %}
// components/Counter.vue
<template>
  <div>
    <span class="count">{{ count }}</span>
    <button @click="increment">+1</button>
    <button @click="decrement">-1</button>
  </div>
</template>

<script>
export default {
  props: {
    initialCount: { type: Number, default: 0 }
  },
  data() {
    return { count: this.initialCount }
  },
  methods: {
    increment() { this.count++ },
    decrement() { this.count-- }
  }
}
</script>
{% endraw %}
```

```javascript
// tests/unit/Counter.spec.js
import { shallowMount } from "@vue/test-utils";
import Counter from "@/components/Counter.vue";

describe("Counter", () => {
  it("initial value should be 0", () => {
    const wrapper = shallowMount(Counter);
    expect(wrapper.find(".count").text()).toBe("0");
  });

  it("initialCount prop takes effect", () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    expect(wrapper.find(".count").text()).toBe("5");
  });

  it("clicking +1 button increments count", async () => {
    const wrapper = shallowMount(Counter);
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".count").text()).toBe("1");
  });

  it("clicking -1 button decrements count", async () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    await wrapper.findAll("button").at(1).trigger("click");
    expect(wrapper.find(".count").text()).toBe("4");
  });
});
```

## Testing Async Operations

```javascript
// components/UserList.vue
export default {
  data() {
    return { users: [], loading: false };
  },
  created() {
    this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      this.loading = true;
      this.users = await this.$api.getUsers();
      this.loading = false;
    },
  },
};
```

```javascript
// tests/unit/UserList.spec.js
import { shallowMount } from "@vue/test-utils";
import UserList from "@/components/UserList.vue";

it("successfully loads user list", async () => {
  const mockUsers = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  // Mock $api
  const wrapper = shallowMount(UserList, {
    mocks: {
      $api: {
        getUsers: jest.fn().mockResolvedValue(mockUsers),
      },
    },
  });

  // Wait for promises to resolve
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick(); // sometimes two ticks are needed

  expect(wrapper.vm.users).toEqual(mockUsers);
  expect(wrapper.vm.loading).toBe(false);
});
```

## Testing Event Emission

```javascript
it("emits search event on submit", async () => {
  const wrapper = shallowMount(SearchBox);

  await wrapper.find("input").setValue("vue");
  await wrapper.find("form").trigger("submit");

  // Check the emitted event and its arguments
  expect(wrapper.emitted("search")).toBeTruthy();
  expect(wrapper.emitted("search")[0]).toEqual(["vue"]);
});
```

## Common `jest.fn()` Usage

```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // return a fixed value
mockFn.mockResolvedValue({ id: 1 }); // return Promise.resolve
mockFn.mockRejectedValue(new Error("Failed")); // return Promise.reject

// Assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(3);
```

## Summary

- `shallowMount`: shallow render (child components become stubs) — faster than `mount`
- `propsData`/`data`/`mocks`: control the component's initial state
- `wrapper.find().trigger()`: simulate user interaction
- `wrapper.emitted()`: check events emitted by the component
- Start writing tests for key logic first — don't chase 100% coverage from day one
