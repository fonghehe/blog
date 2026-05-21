---
title: "Vue 单元测试入门：Jest + Vue Test Utils"
date: 2018-11-03 14:43:25
tags:
  - Vue
readingTime: 2
description: "一直觉得写测试是\"有时间再写\"的事，但组件越来越多之后，每次改代码都提心吊胆。终于花时间搭了测试环境，现在觉得早该写了。"
wordCount: 148
---

一直觉得写测试是"有时间再写"的事，但组件越来越多之后，每次改代码都提心吊胆。终于花时间搭了测试环境，现在觉得早该写了。

## 安装

```bash
# Vue CLI 3 创建项目时选 Unit Testing，或者手动添加
vue add unit-jest

# 手动安装
npm install -D @vue/test-utils jest vue-jest babel-jest
```

## 基础测试：一个计数器组件

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
  it("初始值应为 0", () => {
    const wrapper = shallowMount(Counter);
    expect(wrapper.find(".count").text()).toBe("0");
  });

  it("initialCount prop 生效", () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    expect(wrapper.find(".count").text()).toBe("5");
  });

  it("点击 +1 按钮，count 增加", async () => {
    const wrapper = shallowMount(Counter);
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".count").text()).toBe("1");
  });

  it("点击 -1 按钮，count 减少", async () => {
    const wrapper = shallowMount(Counter, {
      propsData: { initialCount: 5 },
    });
    await wrapper.findAll("button").at(1).trigger("click");
    expect(wrapper.find(".count").text()).toBe("4");
  });
});
```

## 测试异步操作

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

it("成功加载用户列表", async () => {
  const mockUsers = [
    { id: 1, name: "张三" },
    { id: 2, name: "李四" },
  ];

  // 模拟 $api
  const wrapper = shallowMount(UserList, {
    mocks: {
      $api: {
        getUsers: jest.fn().mockResolvedValue(mockUsers),
      },
    },
  });

  // 等待 Promise 完成
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick(); // 有时候需要等两个 tick

  expect(wrapper.vm.users).toEqual(mockUsers);
  expect(wrapper.vm.loading).toBe(false);
});
```

## 测试事件触发

```javascript
it("搜索时触发 search 事件", async () => {
  const wrapper = shallowMount(SearchBox);

  await wrapper.find("input").setValue("vue");
  await wrapper.find("form").trigger("submit");

  // 检查触发的事件和参数
  expect(wrapper.emitted("search")).toBeTruthy();
  expect(wrapper.emitted("search")[0]).toEqual(["vue"]);
});
```

## 常用 jest.fn()

```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue(42); // 返回固定值
mockFn.mockResolvedValue({ id: 1 }); // 返回 Promise.resolve
mockFn.mockRejectedValue(new Error("失败")); // 返回 Promise.reject

// 验证
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
expect(mockFn).toHaveBeenCalledTimes(3);
```

## 小结

- `shallowMount`：浅渲染（子组件变成 stub），比 `mount` 快
- `propsData`/`data`/`mocks`：控制组件初始状态
- `wrapper.find().trigger()`：模拟用户交互
- `wrapper.emitted()`：检查组件触发的事件
- 先从关键逻辑开始写测试，不要一开始就追求 100% 覆盖率
